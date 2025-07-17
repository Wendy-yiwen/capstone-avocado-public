from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv
import os
import re
import logging
from typing import List, Dict, Any, Tuple
import json
import statistics

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Debug mode
DEBUG = True

# Load environment variables from .env file
load_dotenv()

# Add debug information for environment variables
logger.info("Environment variables loaded:")
logger.info(f"SUPABASE_URL exists: {bool(os.getenv('SUPABASE_URL'))}")
logger.info(f"SUPABASE_KEY exists: {bool(os.getenv('SUPABASE_KEY'))}")
logger.info(f"OPENAI_API_KEY exists: {bool(os.getenv('OPENAI_API_KEY'))}")

app = Flask(__name__)
# Configure CORS, adjust according to your frontend domain
CORS(app, resources={r"/api/*": {"origins": "*"}})

class PeerReviewService:
    def __init__(self):
        """Initialize service with Supabase and OpenAI connections"""
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")

        if not self.supabase_url or not self.supabase_key:
            logger.error(f"Debug - URL: {self.supabase_url}")
            logger.error(f"Debug - Key length: {len(self.supabase_key) if self.supabase_key else 'None'}")
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
            
        self.supabase = create_client(self.supabase_url, self.supabase_key)
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def _check_score_distribution_zscore(self, average_scores: Dict[str, float], z_threshold: float = 1.0) -> Tuple[bool, List[str]]:
        """
        Check if there are any outliers in the score distribution using Z-score
        
        Args:
            average_scores: Dictionary of zid to average score
            z_threshold: Z-score threshold for outlier detection
            
        Returns:
            Tuple of (outliers_exist, list_of_outlier_zids)
        """
        if not average_scores:
            return False, []
        scores = list(average_scores.values())
        mean = statistics.mean(scores)
        std = statistics.stdev(scores) if len(scores) > 1 else 0
        outliers = [
            zid for zid, score in average_scores.items()
            if std > 0 and abs(score - mean) / std > z_threshold
        ]
        return len(outliers) > 0, outliers

    def _extract_summary(self, ai_response: str) -> str:
        """
        Extract a summary from the AI response
        
        Args:
            ai_response: The full text response from the AI
            
        Returns:
            Extracted summary text
        """
        lines = ai_response.split("\n")
        for i, line in enumerate(lines):
            if "summary" in line.lower():
                return line + " " + lines[i+1] if i + 1 < len(lines) else line
        return lines[0] if lines else ""

    def _extract_fairness_assessment(self, ai_response: str) -> Dict[str, Any]:
        """
        Extract fairness assessment from AI response
        
        Args:
            ai_response: The full text response from the AI
            
        Returns:
            Dictionary with fairness assessment
        """
        assessment = {"is_fair": True, "issues": []}
        lines = ai_response.lower().split("\n")
        for line in lines:
            if "unfair" in line or "biased" in line or "disparity" in line:
                assessment["is_fair"] = False
                assessment["issues"].append(line.strip())
        return assessment

    def _extract_adjustments(self, ai_response: str, original_scores: Dict[str, float]) -> Dict[str, float]:
        """
        Extract score adjustments from AI response
        
        Args:
            ai_response: The full text response from the AI
            original_scores: Original scores for each student
            
        Returns:
            Dictionary with adjusted scores
        """
        adjustments = original_scores.copy()
        for zid in original_scores:
            match = re.search(fr"{zid}[:\s\-]+\s*(\d+(\.\d+)?)", ai_response)
            if match:
                try:
                    adjustments[zid] = float(match.group(1))
                except:
                    logger.warning(f"Failed to parse adjustment for {zid}")
                    pass
        return adjustments

    def _save_analysis_result(self, group_id, assignment_id, summary, fairness, suggestions):
        """
        Save analysis results to database
        
        Args:
            group_id: The group ID
            assignment_id: The assignment ID
            summary: Summary text
            fairness: Fairness assessment
            suggestions: Suggested score adjustments
        """
        try:
            result = self.supabase.table("contribution_analyses").insert({
                "group_id": group_id,
                "assignment_id": assignment_id,
                "summary": summary,
                "fairness": fairness["is_fair"],
                "fairness_issues": json.dumps(fairness["issues"]),
                "suggested_adjustments": json.dumps(suggestions),
                "created_at": datetime.utcnow().isoformat()
            }).execute()
            logger.info(f"Analysis saved successfully for group {group_id}, assignment {assignment_id}")
            return result
        except Exception as e:
            logger.error(f"[Save Error] {e}")
            raise

    def _get_meeting_attendance(self, group_id: str, members: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get meeting attendance records for group members
        
        Args:
            group_id: The group ID
            members: List of member dictionaries with 'zid' key
            
        Returns:
            Dictionary with attendance statistics per member
        """
        try:
            meetings = self.supabase.table("meetings").select("id").eq("group_id", group_id).execute().data
            if not meetings:
                return {member["zid"]: {"attended": 0, "total": 0, "attendance_rate": 0.0} for member in members}

            meeting_ids = [meeting["id"] for meeting in meetings]
            attendance_records = self.supabase.table("meeting_attendances").select("meeting_id,member_zid").in_("meeting_id", meeting_ids).execute().data

            attendance_count = {member["zid"]: 0 for member in members}
            for record in attendance_records:
                zid = record.get("member_zid")
                if zid in attendance_count:
                    attendance_count[zid] += 1

            result = {}
            total = len(meeting_ids)
            for zid, attended in attendance_count.items():
                rate = round(attended / total, 2) if total > 0 else 0.0
                result[zid] = {"attended": attended, "total": total, "attendance_rate": rate}

            return result
        except Exception as e:
            logger.error(f"[Meeting Attendance Error] {e}")
            return {member["zid"]: {"attended": 0, "total": 0, "attendance_rate": 0.0} for member in members}

    def _get_task_completion(self, group_id: str, assignment_id: str, members: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get task completion statistics for group members
        
        Args:
            group_id: The group ID
            assignment_id: The assignment ID
            members: List of member dictionaries with 'zid' key
            
        Returns:
            Dictionary with task completion statistics per member
        """
        try:
            tasks = self.supabase.table("tasks").select("task_id,description").eq("group_id", group_id).eq("assignment_id", assignment_id).execute().data
            task_ids = [task["task_id"] for task in tasks]
            task_descriptions = {task["task_id"]: task.get("description", "") for task in tasks}

            assignees = self.supabase.table("task_assignees").select("task_id,zid,is_completed").in_("task_id", task_ids).execute().data

            stats = {member["zid"]: {"assigned": 0, "completed": 0, "avg_difficulty": 0.0, "completion_rate": 0.0} for member in members}
            length_sum = {member["zid"]: 0 for member in members}

            for a in assignees:
                zid = a["zid"]
                if zid in stats:
                    stats[zid]["assigned"] += 1
                    if a.get("is_completed"):
                        stats[zid]["completed"] += 1
                    length_sum[zid] += len(task_descriptions.get(a["task_id"], ""))

            for zid, stat in stats.items():
                if stat["assigned"] > 0:
                    stat["avg_difficulty"] = round(length_sum[zid] / stat["assigned"], 2)
                    stat["completion_rate"] = round(stat["completed"] / stat["assigned"], 2)
            return stats
        except Exception as e:
            logger.error(f"[Task Completion Error] {e}")
            return {member["zid"]: {"assigned": 0, "completed": 0, "avg_difficulty": 0.0, "completion_rate": 0.0} for member in members}

    def _get_channel_activity(self, group_id: str, members: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Get channel activity metrics for group members
        
        Args:
            group_id: The group ID
            members: List of member dictionaries with 'zid' key
            
        Returns:
            Dictionary with channel activity statistics per member
        """
        try:
            response = self.supabase.table("channels").select("id").eq("group_id", group_id).execute()
            if not response.data:
                return {member["zid"]: {"message_count": 0} for member in members}

            channel_id = response.data[0]["id"]
            messages_response = self.supabase.table("channel_messages").select("sender_zid").eq("channel_id", channel_id).execute()

            result = {member["zid"]: {"message_count": 0} for member in members}
            if messages_response.data:
                for msg in messages_response.data:
                    zid = msg.get("sender_zid")
                    if zid in result:
                        result[zid]["message_count"] += 1
            return result
        except Exception as e:
            logger.error(f"Error getting channel activity: {str(e)}")
            return {member["zid"]: {"message_count": 0} for member in members}

    def _ai_analyze_contributions(self, attendance, tasks, channel_activity):
        """
        Use AI to analyze contributions based on collected data
        
        Args:
            attendance: Attendance data
            tasks: Task completion data
            channel_activity: Channel activity data
            
        Returns:
            AI analysis text
        """
        try:
            prompt = f"""
Analyze the following student contributions for a group project. Consider attendance, task completion, and discussion activity.

Attendance:
{attendance}

Tasks:
{tasks}

Channel Activity:
{channel_activity}

Please provide a summary, identify any unfair contributions, and suggest score adjustments if necessary.
"""
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful teaching assistant."},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"[OpenAI Error] {e}")
            return "AI analysis unavailable."

    def get_peer_reviews(self, group_id: str, assignment_id: str):
        """
        Get all peer reviews for a specific group and assignment
        
        Args:
            group_id: The group ID
            assignment_id: The assignment ID
            
        Returns:
            List of peer reviews
        """
        try:
            result = self.supabase.table("peer_reviews").select("*").eq("group_id", group_id).eq("assignment_id", assignment_id).execute()
            return result.data
        except Exception as e:
            logger.error(f"[Get Peer Reviews Error] {e}")
            raise

    def get_group_members(self, group_id: str):
        """
        Get all members of a specific group
        
        Args:
            group_id: The group ID
            
        Returns:
            List of group members
        """
        try:
            result = self.supabase.table("group_members").select("*").eq("group_id", group_id).execute()
            return result.data
        except Exception as e:
            logger.error(f"[Get Group Members Error] {e}")
            raise

# Initialize the peer review service
prs = PeerReviewService()

@app.route('/api/peer-reviews', methods=['POST'])
def submit_peer_review():
    """API endpoint to submit a peer review"""
    try:
        data = request.get_json()
        group_id = data.get("group_id")
        assignment_id = data.get("assignment_id")
        reviewer_zid = data.get("reviewer_zid")
        reviewee_zid = data.get("reviewee_zid")
        score = data.get("score")
        comment = data.get("comment")

        # Input validation
        if not all([group_id, assignment_id, reviewer_zid, reviewee_zid, score]):
            return jsonify({"error": "Missing required fields"}), 400
            
        if not isinstance(score, (int, float)) or score < 0 or score > 10:
            return jsonify({"error": "Score must be a number between 0 and 10"}), 400

        result = prs.supabase.table("peer_reviews").insert({
            "group_id": group_id,
            "assignment_id": assignment_id,
            "reviewer_zid": reviewer_zid,
            "reviewee_zid": reviewee_zid,
            "score": score,
            "comment": comment,
            "created_at": datetime.utcnow().isoformat()
        }).execute()

        return jsonify({"status": "success", "data": result.data}), 200
    except Exception as e:
        logger.error(f"[Peer Review Submit Error] {e}")
        return jsonify({"status": "error", "message": "Failed to submit review"}), 500

@app.route('/api/peer-reviews/analyze', methods=['POST'])
def analyze_contribution():
    """API endpoint to analyze contributions and save results"""
    try:
        data = request.get_json()
        group_id = data.get("group_id")
        assignment_id = data.get("assignment_id")

        if not all([group_id, assignment_id]):
            return jsonify({"error": "Missing required fields"}), 400

        # Get group members
        members_response = prs.supabase.table("group_members").select("member_zid").eq("group_id", group_id).execute()
        if not members_response.data:
            return jsonify({"error": "No members found in this group"}), 404

        # Format member data consistently
        members_info = [{"zid": member["member_zid"]} for member in members_response.data]

        # Get all objective data for analysis
        attendance = prs._get_meeting_attendance(group_id, members_info)
        tasks = prs._get_task_completion(group_id, assignment_id, members_info)
        channel = prs._get_channel_activity(group_id, members_info)
        
        # Generate AI analysis
        ai_summary = prs._ai_analyze_contributions(attendance, tasks, channel)
        
        # Extract information from AI analysis
        summary = prs._extract_summary(ai_summary)
        fairness = prs._extract_fairness_assessment(ai_summary)
        
        # Get peer reviews and calculate average scores
        reviews = prs.supabase.table("peer_reviews").select("reviewer_zid,reviewee_zid,score").eq("group_id", group_id).eq("assignment_id", assignment_id).execute().data
        
        # Calculate average scores for each member
        scores = {}
        for member in members_info:
            zid = member["zid"]
            member_reviews = [r for r in reviews if r["reviewee_zid"] == zid]
            if member_reviews:
                scores[zid] = sum(r["score"] for r in member_reviews) / len(member_reviews)
            else:
                scores[zid] = 0.0  # Default score if no reviews
        
        # Check for outliers in the score distribution
        has_outliers, outlier_zids = prs._check_score_distribution_zscore(scores)
        
        # Generate adjustment suggestions
        suggestions = prs._extract_adjustments(ai_summary, scores)
        
        # Save the analysis results to database
        prs._save_analysis_result(group_id, assignment_id, summary, fairness, suggestions)
        
        # Return the analysis data
        return jsonify({
            "status": "success",
            "data": {
                "objective_data": {
                    "attendance": attendance,
                    "tasks": tasks,
                    "channel_activity": channel
                },
                "analysis": {
                    "summary": summary,
                    "fairness": fairness,
                    "average_scores": scores,
                    "has_outliers": has_outliers,
                    "outlier_zids": outlier_zids,
                    "suggested_adjustments": suggestions
                },
                "full_ai_analysis": ai_summary
            }
        })
    except Exception as e:
        logger.error(f"[Analyze Error] {e}")
        return jsonify({"status": "error", "message": "Server error"}), 500

@app.route('/api/peer-reviews/analysis-results/group/<string:group_id>/assignment/<string:assignment_id>', methods=['GET'])
def get_analysis_results(group_id, assignment_id):
    """API endpoint to get saved analysis results"""
    try:
        response = prs.supabase.table("contribution_analyses") \
            .select("*") \
            .eq("group_id", group_id) \
            .eq("assignment_id", assignment_id) \
            .execute()
        return jsonify({"status": "success", "data": response.data})
    except Exception as e:
        logger.error(f"[Analysis Results Fetch Error] {e}")
        return jsonify({"status": "error", "message": "Failed to fetch analysis results"}), 500

@app.route('/api/peer-reviews/group/<string:group_id>/assignment/<string:assignment_id>', methods=['GET'])
def get_group_reviews(group_id, assignment_id):
    """API endpoint to get all peer reviews for a group and assignment"""
    try:
        response = prs.supabase.table("peer_reviews") \
            .select("*") \
            .eq("group_id", group_id) \
            .eq("assignment_id", assignment_id) \
            .execute()
        return jsonify({"status": "success", "data": response.data})
    except Exception as e:
        logger.error(f"[Get Group Reviews Error] {e}")
        return jsonify({"status": "error", "message": "Failed to fetch group reviews"}), 500

@app.route('/api/peer-reviews/member/<string:zid>', methods=['GET'])
def get_member_reviews(zid):
    """API endpoint to get all reviews by or for a specific member"""
    try:
        reviewer = request.args.get('as_reviewer', 'false').lower() == 'true'
        if reviewer:
            response = prs.supabase.table("peer_reviews") \
                .select("*") \
                .eq("reviewer_zid", zid) \
                .execute()
        else:
            response = prs.supabase.table("peer_reviews") \
                .select("*") \
                .eq("reviewee_zid", zid) \
                .execute()
        return jsonify({"status": "success", "data": response.data})
    except Exception as e:
        logger.error(f"[Get Member Reviews Error] {e}")
        return jsonify({"status": "error", "message": "Failed to fetch member reviews"}), 500

if __name__ == '__main__':
    print("========================")
    print("Starting peer review service...")
    print(f"Server will run at http://localhost:5003")
    print(f"Debug mode: {DEBUG}")
    print("Use Ctrl+C to stop the server")
    print("========================")
    
    # Test database connection
    try:
        test_response = prs.supabase.table('users').select("*").limit(1).execute()
        print("✅ Database connection successful!")
        print(f"Test query result: {test_response.data}")
    except Exception as e:
        print("❌ Database connection failed!")
        print(f"Error message: {str(e)}")
    
    app.run(
        host='0.0.0.0',
        port=5003,
        debug=DEBUG
    )