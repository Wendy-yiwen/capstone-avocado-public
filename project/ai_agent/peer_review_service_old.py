#!/usr/bin/env python
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from supabase.client import create_client, Client
import traceback
from datetime import datetime
import numpy as np
from openai import OpenAI
import re
from typing import List, Dict, Any, Optional, Tuple
import json
# Load environment variables
load_dotenv()

# Initialize Flask and CORS
app = Flask(__name__)
app.config['FLASK_ASYNC'] = True  # Enable async support
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000", "supports_credentials": True}})

# Initialize OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set")

supabase: Client = create_client(supabase_url, supabase_key)

# Add test connection code
try:
    # Test connection using standard API
    test_response = supabase.table('users').select("*").limit(1).execute()
    print("✅ Database connection successful!")
    print(f"Test query result: {test_response.data}")
except Exception as e:
    print("❌ Database connection failed!")
    print(f"Error message: {str(e)}")
    traceback.print_exc()


# Contribution assessment parameters
ATTENDANCE_WEIGHT = 0.3  # Meeting attendance weight
TASK_COMPLETION_WEIGHT = 0.5  # Task completion weight
TASK_DIFFICULTY_WEIGHT = 0.2  # Task difficulty weight

# Contribution difference threshold (triggers AI judgment when exceeded)
CONTRIBUTION_THRESHOLD = 0.25  # 25% difference


class PeerReviewService:
    def __init__(self, supabase_client: Client, openai_client: OpenAI):
        self.supabase = supabase_client
        self.openai = openai_client
    
    async def analyze_contribution(self, group_id: str, assignment_id: str) -> Dict[str, Any]:
        """Analyze the contribution of a group in a specific assignment"""
        try:
            # 1. Get group members
            members = await self._get_group_members(group_id)
            if not members:
                return {"error": "No members found in this group"}
            
            # 2. Get peer review data
            peer_reviews = await self._get_peer_reviews(group_id, assignment_id)
            
            # 3. Calculate average scores
            average_scores = self._calculate_average_scores(members, peer_reviews)
            
            # 4. Check if AI judgment is needed
            needs_ai_verification, outliers = self._check_score_distribution(average_scores)
            
            # 5. If AI judgment is needed, collect objective data
            if needs_ai_verification:
                print(f"Detected score imbalance. Outliers: {outliers}")
                
                # Collect meeting attendance data
                attendance_data = await self._get_meeting_attendance(group_id, members)
                
                # Collect task completion data
                task_data = await self._get_task_completion(group_id, assignment_id, members)

                channel_data = await self._get_channel_activity(group_id, members)

                
                # Use AI for analysis
                ai_analysis = await self._ai_analyze_contributions(
                    average_scores, 
                    outliers, 
                    attendance_data, 
                    task_data,
                    peer_reviews
                )
                
                # Save analysis result to database
                try:
                    await self._save_analysis_result(
                        group_id, 
                        assignment_id, 
                        average_scores, 
                        ai_analysis
                    )
                except Exception as e:
                    print(f"Warning: Failed to save analysis result to database: {str(e)}")
                    traceback.print_exc()
                
                return {
                    "needs_verification": True,
                    "average_scores": average_scores,
                    "outliers": outliers,
                    "objective_data": {
                        "attendance": attendance_data,
                        "tasks": task_data,
                        "channel_activity": channel_data, 
                    },
                    "ai_analysis": ai_analysis
                }
            else:
                return {
                    "needs_verification": False,
                    "average_scores": average_scores
                }
                
        except Exception as e:
            print(f"Error analyzing contribution: {str(e)}")
            traceback.print_exc()
            return {"error": str(e)}

    async def _get_channel_activity(self, group_id: str, members: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Get channel activity (message counts) for each group member"""
        try:
            response = self.supabase.table("channels")\
                .select("id")\
                .eq("group_id", group_id)\
                .execute()

            if not response.data:
                return {member["zid"]: {"message_count": 0} for member in members}

            channel_id = response.data[0]["id"]

            messages_response = self.supabase.table("channel_messages")\
                .select("sender_zid")\
                .eq("channel_id", channel_id)\
                .execute()

            result = {member["zid"]: {"message_count": 0} for member in members}
            if messages_response.data:
                for msg in messages_response.data:
                    sender = msg.get("sender_zid")
                    if sender in result:
                        result[sender]["message_count"] += 1

            return result
        except Exception as e:
            print(f"Error getting channel activity: {str(e)}")
            return {member["zid"]: {"message_count": 0} for member in members}

    
    async def _get_group_members(self, group_id: str) -> List[Dict[str, Any]]:
        """Get the list of group members"""
        try:
            response = self.supabase.table("group_members") \
                .select("member_zid, is_leader") \
                .eq("group_id", group_id) \
                .execute()
                
            if not response.data:
                return []
                
            # Get member details
            member_zids = [m["member_zid"] for m in response.data]
            users_response = self.supabase.table("users") \
                .select("zid, name") \
                .in_("zid", member_zids) \
                .execute()
                
            # Merge data
            members = []
            for member in response.data:
                user = next((u for u in users_response.data if u["zid"] == member["member_zid"]), None)
                if user:
                    members.append({
                        "zid": member["member_zid"],
                        "name": user["name"],
                        "is_leader": member["is_leader"]
                    })
            
            return members
        except Exception as e:
            print(f"Error getting group members: {str(e)}")
            traceback.print_exc()
            return []
    
    async def _get_peer_reviews(self, group_id: str, assignment_id: str) -> List[Dict[str, Any]]:
        """Get peer review data for the group"""
        try:
            response = self.supabase.table("peer_reviews") \
                .select("reviewer_zid, reviewee_zid, score, comment") \
                .eq("group_id", group_id) \
                .eq("assignment_id", assignment_id) \
                .execute()
                
            return response.data if response.data else []
        except Exception as e:
            print(f"Error getting peer reviews: {str(e)}")
            traceback.print_exc()
            return []
    
    def _calculate_average_scores(self, members: List[Dict[str, Any]], peer_reviews: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculate the average score for each member"""
        if not peer_reviews:
            return {member["zid"]: 0 for member in members}
            
        scores = {member["zid"]: [] for member in members}
        
        # Collect all ratings received by each person
        for review in peer_reviews:
            reviewee = review["reviewee_zid"]
            if reviewee in scores:
                scores[reviewee].append(review["score"])
        
        # Calculate average scores
        average_scores = {}
        for zid, score_list in scores.items():
            average_scores[zid] = round(sum(score_list) / len(score_list), 2) if score_list else 0
            
        return average_scores
    
    def _check_score_distribution(self, average_scores: Dict[str, float]) -> Tuple[bool, List[str]]:
        """Check if the score distribution requires AI verification"""
        if not average_scores:
            return False, []
            
        scores = list(average_scores.values())
        mean_score = sum(scores) / len(scores)
        
        # Find members whose scores differ from the average by more than the threshold
        outliers = [
            zid for zid, score in average_scores.items() 
            if abs(score - mean_score) / max(mean_score, 1) > CONTRIBUTION_THRESHOLD
        ]
        
        return len(outliers) > 0, outliers
    
    async def _get_meeting_attendance(self, group_id: str, members: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Get meeting attendance data"""
        try:
            # Get all meetings for the group
            meetings_response = self.supabase.table("meetings") \
                .select("id, start_time, end_time") \
                .eq("group_id", group_id) \
                .execute()
                
            if not meetings_response.data:
                return {member["zid"]: {"attendance_rate": 0, "meetings_count": 0} for member in members}
                
            # Get all attendance records
            meeting_ids = [m["id"] for m in meetings_response.data]
            attendance_response = self.supabase.table("meeting_attendances") \
                .select("meeting_id, member_zid, join_time, leave_time") \
                .in_("meeting_id", meeting_ids) \
                .execute()
                
            # Initialize results
            result = {member["zid"]: {"attended": 0, "total": len(meetings_response.data)} for member in members}
            
            # Calculate attendance rate for each member
            if attendance_response.data:
                for attendance in attendance_response.data:
                    member_zid = attendance["member_zid"]
                    if member_zid in result:
                        result[member_zid]["attended"] += 1
            
            # Calculate attendance rate
            for zid in result:
                attendance_rate = result[zid]["attended"] / result[zid]["total"] if result[zid]["total"] > 0 else 0
                result[zid]["attendance_rate"] = round(attendance_rate, 2)
                
            return result
        except Exception as e:
            print(f"Error getting meeting attendance: {str(e)}")
            traceback.print_exc()
            return {member["zid"]: {"attendance_rate": 0, "meetings_count": 0} for member in members}
    
    async def _get_task_completion(self, group_id: str, assignment_id: str, members: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Get task completion data"""
        try:
            # Initialize results
            result = {member["zid"]: {"assigned": 0, "completed": 0, "difficulty": 0} for member in members}
            
            # Get all tasks for the group and assignment
            tasks_response = self.supabase.table("tasks") \
                .select("task_id, task_name, description, status_id, type") \
                .eq("group_id", group_id) \
                .eq("assignment_id", assignment_id) \
                .execute()
                
            if not tasks_response.data:
                return result
                
            # Get task assignments
            task_ids = [t["task_id"] for t in tasks_response.data]
            assignments_response = self.supabase.table("task_assignees") \
                .select("task_id, assignee_id") \
                .in_("task_id", task_ids) \
                .execute()
                
            # Get status information
            statuses_response = self.supabase.table("statuses") \
                .select("status_id, status_name") \
                .execute()
                
            status_map = {s["status_id"]: s["status_name"] for s in statuses_response.data} if statuses_response.data else {}
            
            # Calculate task completion for each member
            if tasks_response.data and assignments_response.data:
                # Create a mapping from task ID to task
                task_map = {t["task_id"]: t for t in tasks_response.data}
                
                # Count tasks for each person
                for assignment in assignments_response.data:
                    assignee_id = assignment["assignee_id"]
                    task_id = assignment["task_id"]
                    
                    if assignee_id in result and task_id in task_map:
                        task = task_map[task_id]
                        result[assignee_id]["assigned"] += 1
                        
                        # Check if the task is completed (assuming status_id=3 means completed)
                        if task.get("status_id") == 3 or status_map.get(task.get("status_id")) == "Completed":
                            result[assignee_id]["completed"] += 1
                        
                        # Estimate task difficulty (can be based on description length or complexity)
                        # In a real system, tasks should have an explicit difficulty indicator
                        description_length = len(task.get("description", "")) if task.get("description") else 0
                        result[assignee_id]["difficulty"] += min(5, max(1, description_length // 100))
            
            # Calculate completion rate
            for zid in result:
                completion_rate = result[zid]["completed"] / result[zid]["assigned"] if result[zid]["assigned"] > 0 else 0
                avg_difficulty = result[zid]["difficulty"] / result[zid]["assigned"] if result[zid]["assigned"] > 0 else 0
                
                result[zid]["completion_rate"] = round(completion_rate, 2)
                result[zid]["avg_difficulty"] = round(avg_difficulty, 2)
                
            return result
        except Exception as e:
            print(f"Error getting task completion: {str(e)}")
            traceback.print_exc()
            return {member["zid"]: {"assigned": 0, "completed": 0, "difficulty": 0} for member in members}
    
    async def _ai_analyze_contributions(
        self, 
        average_scores: Dict[str, float],
        outliers: List[str],
        attendance_data: Dict[str, Dict[str, Any]],
        task_data: Dict[str, Dict[str, Any]],
        peer_reviews: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Use AI to analyze contribution differences"""
        try:
            # Prepare input data
            input_data = []
            for zid, score in average_scores.items():
                is_outlier = zid in outliers
                attendance = attendance_data.get(zid, {"attendance_rate": 0})
                tasks = task_data.get(zid, {"assigned": 0, "completed": 0, "completion_rate": 0, "avg_difficulty": 0})
                
                # Collect all comments received by this person
                comments = []
                for review in peer_reviews:
                    if review.get("reviewee_zid") == zid and review.get("comment"):
                        comments.append({
                            "from": review.get("reviewer_zid"),
                            "score": review.get("score"),
                            "comment": review.get("comment")
                        })
                
                member_data = {
                    "zid": zid,
                    "peer_review_score": score,
                    "is_outlier": is_outlier,
                    "attendance_rate": attendance.get("attendance_rate", 0),
                    "task_assigned": tasks.get("assigned", 0),
                    "task_completed": tasks.get("completed", 0),
                    "task_completion_rate": tasks.get("completion_rate", 0),
                    "task_avg_difficulty": tasks.get("avg_difficulty", 0),
                    "comments": comments
                }
                
                input_data.append(member_data)
            
            # Calculate objective contribution metrics
            for member in input_data:
                # Weighted calculation of objective contribution
                objective_score = (
                    member["attendance_rate"] * ATTENDANCE_WEIGHT +
                    member["task_completion_rate"] * TASK_COMPLETION_WEIGHT +
                    (member["task_avg_difficulty"] / 5) * TASK_DIFFICULTY_WEIGHT  # Assuming maximum difficulty is 5
                )
                member["objective_score"] = min(1.0, max(0.0, objective_score))
            
            # Prepare AI analysis prompt
            messages = [
                {"role": "system", "content": """You are an AI expert in contribution assessment, focusing on analyzing contribution differences in group projects.
Your task is to analyze the match between peer review scores and objective data within a group, especially identifying situations where scores may be problematic.
Please evaluate whether each member's actual contribution aligns with their peer reviews, based on meeting attendance, task completion, and task difficulty.
For members with notably low scores (marked as outliers), pay special attention to their objective performance to determine whether the scores are reasonable.

You should provide:
1. An overall analysis of the fairness of peer reviews
2. Specific examination of outliers (members with unusually high or low scores)
3. If you find unfair assessments, explain why they appear unfair
4. Suggested adjustments to scores where appropriate, based on objective metrics
5. Specific recommendations for the team

Your analysis should aim to be fair, balanced, and helpful for resolving contribution disputes."""},
                {"role": "user", "content": f"""
Please analyze the following contribution data for group members and provide your professional judgment:

1. Peer review scores:
{', '.join([f"{member['zid']}: {member['peer_review_score']:.2f}" for member in input_data])}

2. Attendance rates:
{', '.join([f"{member['zid']}: {member['attendance_rate']*100:.1f}%" for member in input_data])}

3. Task completion:
{', '.join([f"{member['zid']}: assigned {member['task_assigned']} tasks, completed {member['task_completed']} tasks, completion rate {member['task_completion_rate']*100:.1f}%" for member in input_data])}

4. Average task difficulty (1-5):
{', '.join([f"{member['zid']}: {member['task_avg_difficulty']:.1f}" for member in input_data])}

5. Objective contribution metrics based on data:
{', '.join([f"{member['zid']}: {member['objective_score']*10:.1f}/10" for member in input_data])}

6. Comments received:
{json.dumps({m['zid']: m['comments'] for m in input_data}, indent=2)}

Members requiring special attention (outliers):
{', '.join(outliers) if outliers else 'None'}

Please analyze the following:
1. Fairness and reasonableness of group ratings
2. Whether low-rated members actually contributed less (based on objective metrics)
3. Whether there are unfair ratings
4. How you think the true contribution should be distributed
5. Provide adjusted contribution scores (if necessary)
"""}
            ]
            
            # Call OpenAI API for analysis
            response = self.openai.chat.completions.create(
                model="gpt-3.5-turbo",  # Or use a more advanced model
                messages=messages,
                max_tokens=1500,
                temperature=0.2,  # Lower temperature for more deterministic answers
            )
            
            # Get AI analysis results
            analysis_text = response.choices[0].message.content
            
            # Extract summary and suggested adjustments
            summary = self._extract_summary(analysis_text)
            suggested_adjustments = self._extract_adjustments(analysis_text, average_scores)
            fairness_assessment = self._extract_fairness_assessment(analysis_text)
            recommendations = self._extract_recommendations(analysis_text)
            
            # Prepare the comprehensive analysis result
            ai_analysis = {
                "raw_response": analysis_text,
                "summary": summary,
                "fairness_assessment": fairness_assessment,
                "objective_scores": {member["zid"]: round(member["objective_score"] * 10, 1) for member in input_data},  # Convert to 10-point scale
                "suggested_adjustments": suggested_adjustments,
                "recommendations": recommendations
            }
            
            return ai_analysis
            
        except Exception as e:
            print(f"Error in AI analysis: {str(e)}")
            traceback.print_exc()
            return {"error": str(e)}
    
    def _extract_summary(self, ai_response: str) -> str:
        """Extract summary from AI response"""
        # Simple implementation, could be more complex
        lines = ai_response.split("\n")
        summary_lines = []
        
        # Look for summary paragraphs
        in_summary = False
        for line in lines:
            if "summary" in line.lower() or "conclusion" in line.lower() or "overview" in line.lower():
                in_summary = True
                summary_lines.append(line)
                continue
                
            if in_summary and line.strip() and not line.startswith('#'):
                summary_lines.append(line)
            elif in_summary and not line.strip():
                in_summary = False
        
        # If no explicit summary found, extract key points
        if not summary_lines:
            for line in lines:
                if ("fair" in line.lower() or "unfair" in line.lower() or 
                    "suggest" in line.lower() or "conclusion" in line.lower() or
                    "recommend" in line.lower()):
                    summary_lines.append(line)
        
        # If still no summary, take first few lines
        if not summary_lines and lines:
            return "\n".join(lines[:3])
            
        return "\n".join(summary_lines[:5])  # Return at most 5 lines of summary
    
    def _extract_fairness_assessment(self, ai_response: str) -> Dict[str, Any]:
        """Extract fairness assessment from AI response"""
        assessment = {
            "is_fair": True,  # Default to true
            "issues": []
        }
        
        # Look for fairness indicators
        if "unfair" in ai_response.lower() or "disparity" in ai_response.lower() or "inconsistent" in ai_response.lower():
            assessment["is_fair"] = False
            
            # Extract issues
            lines = ai_response.split("\n")
            for i, line in enumerate(lines):
                if "unfair" in line.lower() or "disparity" in line.lower() or "inconsistent" in line.lower():
                    # Add this line and potentially the next as an issue
                    issue = line.strip()
                    if i+1 < len(lines) and lines[i+1].strip() and not lines[i+1].startswith("#"):
                        issue += " " + lines[i+1].strip()
                    assessment["issues"].append(issue)
        
        return assessment
    
    def _extract_adjustments(self, ai_response: str, original_scores: Dict[str, float]) -> Dict[str, float]:
        """Try to extract suggested adjustment scores from AI response"""
        # This is a simplified implementation; a real system might need more complex parsing
        import re
        suggested_scores = original_scores.copy()
        
        # Check for a score adjustment section
        adjustment_section = None
        lines = ai_response.split("\n")
        for i, line in enumerate(lines):
            if "suggested" in line.lower() and "adjustment" in line.lower() and "score" in line.lower():
                adjustment_section = "\n".join(lines[i:i+10])  # Take this line and up to 9 more
                break
                
        if not adjustment_section:
            for i, line in enumerate(lines):
                if "recommend" in line.lower() and "score" in line.lower():
                    adjustment_section = "\n".join(lines[i:i+10])
                    break
        
        if adjustment_section:
            # Look for patterns like "z5325769: 6.5" or "z5325769 - 6.5" or "adjust z5325769's score to 6.5"
            import re
            for zid in original_scores:
                patterns = [
                    f"{zid}[:\\s-]+\\s*(\\d+(\\.\\d+)?)",  # z1234567: 7.5 or z1234567 - 7.5
                    f"{zid}'s score to (\\d+(\\.\\d+)?)",  # z1234567's score to 7.5
                    f"recommend\\s+{zid}:\\s*(\\d+(\\.\\d+)?)"  # recommend z1234567: 7.5
                ]
                
                for pattern in patterns:
                    matches = re.findall(pattern, adjustment_section, re.IGNORECASE)
                    if matches:
                        try:
                            suggested_scores[zid] = round(float(matches[0][0]), 2)
                            break
                        except:
                            pass  # Keep original score if conversion fails
        
        return suggested_scores
    
    def _extract_recommendations(self, ai_response: str) -> List[str]:
        """Extract recommendations from AI response"""
        recommendations = []
        
        # Look for recommendation section
        recommendation_section = None
        lines = ai_response.split("\n")
        
        for i, line in enumerate(lines):
            if ("recommendation" in line.lower() or "recommend" in line.lower()) and ("#" in line or ":" in line):
                start_idx = i
                end_idx = i + 1
                
                # Find end of section
                while end_idx < len(lines) and lines[end_idx].strip():
                    end_idx += 1
                
                recommendation_section = lines[start_idx:end_idx]
                break
        
        # If found, extract bullet points or numbered items
        if recommendation_section:
            for line in recommendation_section:
                # Skip the header
                if ("#" in line and "recommendation" in line.lower()) or (":" in line and "recommendation" in line.lower()):
                    continue
                    
                # Look for bullet points or numbers
                stripped = line.strip()
                if stripped and (stripped.startswith("-") or stripped.startswith("*") or 
                                 stripped.startswith("•") or re.match(r"^\d+\.", stripped)):
                    recommendations.append(stripped)
                elif stripped and len(recommendations) > 0:
                    # Continuation of previous point
                    recommendations[-1] += " " + stripped
        
        # If no structured recommendations found, look for sentences with recommend/suggestion
        if not recommendations:
            import re
            for line in lines:
                if "recommend" in line.lower() or "suggest" in line.lower() or "should" in line.lower():
                    # Clean up the line - remove leading numbers or bullets
                    cleaned = re.sub(r"^[\d\.\-\*•\s]+", "", line.strip())
                    if cleaned:
                        recommendations.append(cleaned)
        
        return recommendations[:5]  # Limit to 5 recommendations
    
    async def _save_analysis_result(self, group_id: str, assignment_id: str, 
                                   average_scores: Dict[str, float], 
                                   ai_analysis: Dict[str, Any]) -> None:
        """Save analysis results to database"""
        try:
            # Save a record for each member
            for zid, peer_score in average_scores.items():
                objective_score = ai_analysis.get("objective_scores", {}).get(zid)
                ai_adjusted_score = ai_analysis.get("suggested_adjustments", {}).get(zid)
                
                # Create or update record
                analysis_data = {
                    "group_id": group_id,
                    "assignment_id": assignment_id,
                    "member_zid": zid,
                    "peer_score": peer_score,
                    "objective_score": objective_score,
                    "ai_adjusted_score": ai_adjusted_score,
                    "needs_verification": zid in ai_analysis.get("fairness_assessment", {}).get("issues", []),
                    "analysis_data": json.dumps({
                        "summary": ai_analysis.get("summary"),
                        "recommendations": ai_analysis.get("recommendations"),
                        "fairness_issues": ai_analysis.get("fairness_assessment", {}).get("issues", [])
                    })
                }
                
                # Check if record exists
                check_response = self.supabase.table("contribution_analyses") \
                    .select("id") \
                    .eq("group_id", group_id) \
                    .eq("assignment_id", assignment_id) \
                    .eq("member_zid", zid) \
                    .execute()
                    
                if check_response.data:
                    # Update existing record
                    self.supabase.table("contribution_analyses") \
                        .update(analysis_data) \
                        .eq("id", check_response.data[0]["id"]) \
                        .execute()
                else:
                    # Insert new record
                    self.supabase.table("contribution_analyses") \
                        .insert(analysis_data) \
                        .execute()
                    
        except Exception as e:
            print(f"Error saving analysis results: {str(e)}")
            traceback.print_exc()
            raise


# API route: Submit peer review
@app.route('/api/peer-reviews', methods=['POST'])
def submit_peer_review():
    data = request.json
    if not data:
        return jsonify({"status": "fail", "message": "No data provided"}), 400
    
    required_fields = ['group_id', 'assignment_id', 'reviewer_zid', 'reviewee_zid', 'score']
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return jsonify({"status": "fail", "message": f"Missing required fields: {', '.join(missing_fields)}"}), 400
    
    try:
        # Check score range
        if not (0 <= data['score'] <= 10):
            return jsonify({"status": "fail", "message": "Score must be between 0 and 10"}), 400
        
        # Check that reviewer and reviewee are not the same person
        if data['reviewer_zid'] == data['reviewee_zid']:
            return jsonify({"status": "fail", "message": "Cannot review yourself"}), 400
        
        # Check if reviewer and reviewee are in the same group
        group_check = supabase.table("group_members") \
            .select("member_zid") \
            .eq("group_id", data['group_id']) \
            .in_("member_zid", [data['reviewer_zid'], data['reviewee_zid']]) \
            .execute()
            
        if len(group_check.data) < 2:
            return jsonify({"status": "fail", "message": "Reviewer and reviewee must be in the same group"}), 400
        
        # Check if review has already been submitted
        existing_check = supabase.table("peer_reviews") \
            .select("id") \
            .eq("group_id", data['group_id']) \
            .eq("assignment_id", data['assignment_id']) \
            .eq("reviewer_zid", data['reviewer_zid']) \
            .eq("reviewee_zid", data['reviewee_zid']) \
            .execute()
            
        if existing_check.data:
            # Update existing review
            response = supabase.table("peer_reviews") \
                .update({"score": data['score'], "comment": data.get('comment', '')}) \
                .eq("id", existing_check.data[0]['id']) \
                .execute()
                
            return jsonify({"status": "success", "message": "Peer review updated", "data": response.data})
        else:
            # Add new review
            review_data = {
                "group_id": data['group_id'],
                "assignment_id": data['assignment_id'],
                "reviewer_zid": data['reviewer_zid'],
                "reviewee_zid": data['reviewee_zid'],
                "score": data['score'],
                "comment": data.get('comment', ''),
                "created_at": datetime.now().isoformat()
            }
            
            response = supabase.table("peer_reviews").insert(review_data).execute()
            return jsonify({"status": "success", "message": "Peer review submitted", "data": response.data})
            
    except Exception as e:
        print(f"Error submitting peer review: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to submit peer review", "error": str(e)}), 500


# API route: Get group peer review results
@app.route('/api/peer-reviews/group/<string:group_id>/assignment/<string:assignment_id>', methods=['GET'])
def get_group_peer_reviews(group_id, assignment_id):
    try:
        response = supabase.table("peer_reviews") \
            .select("reviewer_zid, reviewee_zid, score, comment") \
            .eq("group_id", group_id) \
            .eq("assignment_id", assignment_id) \
            .execute()
            
        return jsonify({"status": "success", "data": response.data})
    except Exception as e:
        print(f"Error getting peer reviews: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to get peer reviews", "error": str(e)}), 500


# API route: Analyze group contributions
@app.route('/api/peer-reviews/analyze', methods=['POST'])
async def analyze_group_contributions():
    data = request.json
    if not data:
        return jsonify({"status": "fail", "message": "No data provided"}), 400
    
    required_fields = ['group_id', 'assignment_id']
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return jsonify({"status": "fail", "message": f"Missing required fields: {', '.join(missing_fields)}"}), 400
    
    try:
        # Create service instance
        service = PeerReviewService(supabase, client)
        
        # Analyze contributions
        result = await service.analyze_contribution(data['group_id'], data['assignment_id'])
        
        return jsonify({"status": "success", "data": result})
    except Exception as e:
        print(f"Error analyzing contributions: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to analyze contributions", "error": str(e)}), 500


# API route: Get saved analysis results
@app.route('/api/peer-reviews/analysis-results/<string:group_id>/assignment/<string:assignment_id>', methods=['GET'])
def get_analysis_results(group_id, assignment_id):
    try:
        response = supabase.table("contribution_analyses") \
            .select("member_zid, peer_score, objective_score, ai_adjusted_score, needs_verification, analysis_data") \
            .eq("group_id", group_id) \
            .eq("assignment_id", assignment_id) \
            .execute()
            
        # Process the results to include member names
        if response.data:
            # Get member names
            member_zids = [record["member_zid"] for record in response.data if "member_zid" in record]
            if member_zids:
                users_response = supabase.table("users") \
                    .select("zid, name") \
                    .in_("zid", member_zids) \
                    .execute()
                
                # Create a map of zid to name
                name_map = {user["zid"]: user["name"] for user in users_response.data} if users_response.data else {}
                
                # Add names to the response
                for record in response.data:
                    if record.get("member_zid") in name_map:
                        record["member_name"] = name_map[record["member_zid"]]
                    else:
                        record["member_name"] = "Unknown"
        
        return jsonify({"status": "success", "data": response.data})
    except Exception as e:
        print(f"Error getting analysis results: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "fail", "message": "Failed to get analysis results", "error": str(e)}), 500


# Service startup code
if __name__ == '__main__':
    import asyncio
    from hypercorn.config import Config
    from hypercorn.asyncio import serve
    
    config = Config()
    config.bind = ["0.0.0.0:5003"]  # Use port 5003 to avoid conflicts with existing services
    
    print("========================")
    print("Starting peer review service...")
    print(f"Server will run at http://localhost:5003")
    print("Use Ctrl+C to stop the server")
    print("========================")
    
    asyncio.run(serve(app, config))