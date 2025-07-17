from flask import Flask, jsonify, request
import json
from datetime import datetime

app = Flask(__name__)

# Error message analog data storage
peer_reviews = []

@app.route('/api/channels', methods=['GET'])
def get_channels():
    # Returns some simulated channel data
    channels = [
        {
            "created_at": "2025-04-10T20:44:43",
            "created_by": "z1234567",
            "id": "d0714880-9cbb-4fb8-bb2c-c7bff017b963",
            "is_private": False,
            "name": "test_channel_1"
        },
        {
            "created_at": "2025-04-11T13:56:27",
            "created_by": "z5678901",
            "id": "6528dec9-3316-4e8d-9295-ec3e80aa5533",
            "is_private": False,
            "name": "test_channel_2"
        }
    ]
    return jsonify({"status": "success", "data": channels})

@app.route('/api/peer-reviews', methods=['POST'])
def submit_peer_review():
    data = request.json
    # Adding a Time Stamp
    data['submitted_at'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    # Add ID
    data['id'] = len(peer_reviews) + 1
    peer_reviews.append(data)
    return jsonify({"status": "success", "data": [data]})

@app.route('/api/peer-reviews/group/<int:group_id>/assignment/<int:assignment_id>', methods=['GET'])
def get_peer_reviews(group_id, assignment_id):
    # Filter out eligible reviews
    filtered_reviews = [
        r for r in peer_reviews 
        if r.get('group_id') == group_id and r.get('assignment_id') == assignment_id
    ]
    return jsonify({"status": "success", "data": filtered_reviews})

@app.route('/api/peer-reviews/analyze', methods=['POST'])
def analyze_contributions():
    data = request.json
    group_id = data.get('group_id')
    assignment_id = data.get('assignment_id')
    
    # Filter out eligible reviews
    filtered_reviews = [
        r for r in peer_reviews 
        if r.get('group_id') == group_id and r.get('assignment_id') == assignment_id
    ]
    
    if not filtered_reviews:
        return jsonify({"status": "fail", "message": "No reviews found"}), 404
    
    # Get all members
    members = set()
    for review in filtered_reviews:
        members.add(review.get('reviewer_zid'))
        members.add(review.get('reviewee_zid'))
    
    # Calculation of average scores
    scores = {}
    for member in members:
        member_reviews = [r for r in filtered_reviews if r.get('reviewee_zid') == member]
        if member_reviews:
            avg_score = sum(r.get('score', 0) for r in member_reviews) / len(member_reviews)
            scores[member] = round(avg_score, 2)
        else:
            scores[member] = None
    
    # Collection of comments
    comments = {}
    for member in members:
        member_comments = [r.get('comment') for r in filtered_reviews if r.get('reviewee_zid') == member]
        comments[member] = member_comments
    
    analysis = {
        "group_id": group_id,
        "assignment_id": assignment_id,
        "member_count": len(members),
        "review_count": len(filtered_reviews),
        "average_scores": scores,
        "comments": comments
    }
    
    return jsonify({"status": "success", "data": analysis})

if __name__ == '__main__':
    print("Start the simulation server on port 5002...")
    print("Use Ctrl+C to stop the server")
    app.run(debug=True, port=5002)