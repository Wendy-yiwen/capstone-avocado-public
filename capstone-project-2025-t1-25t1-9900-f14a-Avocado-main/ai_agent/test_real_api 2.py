import requests
import json
import re

# Use the actual server port
BASE_URL = "http://localhost:5003"

def test_channel_activity():
    # Test Server Connection
    try:
        response = requests.get(f"{BASE_URL}/api/peer-reviews/group/2/assignment/1")
        print(f"Server connection test: {response.status_code}")
    except Exception as e:
        print(f"Unable to connect to the server: {e}")
        return
    
    # Based on the database screenshot, we know that:
    # group_id=2 includes z5325769(Wolf)
    # We need to identify what other members are in the group
    print("Query members of group 2...")
    response = requests.get(f"{BASE_URL}/api/peer-reviews/group/2/assignment/1")
    if response.status_code == 200:
        data = response.json().get("data", [])
        members = set()
        for review in data:
            if "reviewer_zid" in review:
                members.add(review["reviewer_zid"])
            if "reviewee_zid" in review:
                members.add(review["reviewee_zid"])
        print(f"Current members of Group 2: {members}")
    
    # Based on the database screenshot, we know that these users are in group 2
    reviews = [
        # Wolf and Wolf themselves can't rate each other, so we need to make sure we use different users
        {"group_id": 2, "assignment_id": 1, "reviewer_zid": "z5325769", "reviewee_zid": "z5325799", "score": 8, "comment": "Good work"},
        {"group_id": 2, "assignment_id": 1, "reviewer_zid": "z5325799", "reviewee_zid": "z5325769", "score": 4, "comment": "Missed meetings"}
    ]
    
    print("\nSubmission of test evaluations...")
    for review in reviews:
        response = requests.post(f"{BASE_URL}/api/peer-reviews", json=review)
        print(f"Evaluation submission status: {response.status_code}")
        print(f"Response content: {response.text[:100]}...")
    
    # Request analysis
    print("\nRequest analysis...")
    response = requests.post(
        f"{BASE_URL}/api/peer-reviews/analyze",
        json={"group_id": 2, "assignment_id": 1}
    )
    
    print(f"Analyzing Response Status: {response.status_code}")
    if response.status_code == 200:
        try:
            data = response.json()
            print("Analysis:", json.dumps(data, indent=2)[:500])
            
            # Checking if channel_activity data is included
            if "data" in data and "objective_data" in data["data"] and "channel_activity" in data["data"]["objective_data"]:
                print("\nChannel Activity Data:")
                print(json.dumps(data["data"]["objective_data"]["channel_activity"], indent=2))
        except:
            print("Unable to parse JSON response:", response.text[:200])
    else:
        print("Error:", response.text[:200])

if __name__ == "__main__":
    test_channel_activity()