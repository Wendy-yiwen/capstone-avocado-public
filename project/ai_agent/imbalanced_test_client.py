import requests
import json

BASE_URL = "http://localhost:5002"

def test_submit_imbalanced_peer_reviews():
    # Use of already existing members of the same group
    group_id = 1  # According to the first screenshot, these users are in the group with group ID 1
    
    # Creating unbalanced scores
    reviews = [
        # Alice rated the other members and gave Wolf a low score
        {"reviewer_zid": "z1234567", "reviewee_zid": "z1111111", "score": 8, "comment": "Good contribution"},
        {"reviewer_zid": "z1234567", "reviewee_zid": "z5325768", "score": 7, "comment": "Solid work"},
        {"reviewer_zid": "z1234567", "reviewee_zid": "z5325769", "score": 3, "comment": "Minimal contribution, missed meetings"},
        
        # Zora's rating - also rated Wolf low
        {"reviewer_zid": "z1111111", "reviewee_zid": "z1234567", "score": 9, "comment": "Great leadership"},
        {"reviewer_zid": "z1111111", "reviewee_zid": "z5325768", "score": 8, "comment": "Very helpful"},
        {"reviewer_zid": "z1111111", "reviewee_zid": "z5325769", "score": 4, "comment": "Didn't contribute much"},
        
        # Jorah's rating - give Wolf a fair rating
        {"reviewer_zid": "z5325768", "reviewee_zid": "z1234567", "score": 8, "comment": "Good coordination"},
        {"reviewer_zid": "z5325768", "reviewee_zid": "z1111111", "score": 7, "comment": "Completed assigned tasks"},
        {"reviewer_zid": "z5325768", "reviewee_zid": "z5325769", "score": 7, "comment": "Actually did complex backend work"},
        
        # Wolf's self-evaluation
        {"reviewer_zid": "z5325769", "reviewee_zid": "z1234567", "score": 8, "comment": "Good team leader"},
        {"reviewer_zid": "z5325769", "reviewee_zid": "z1111111", "score": 7, "comment": "Finished all tasks"},
        {"reviewer_zid": "z5325769", "reviewee_zid": "z5325768", "score": 7, "comment": "Contributed well"}
    ]
    
    # Submit all evaluations
    for i, review in enumerate(reviews):
        payload = {
            "group_id": group_id,
            "assignment_id": 1,  # Use 1 as the test job ID
            **review
        }
        
        response = requests.post(f"{BASE_URL}/api/peer-reviews", json=payload)
        print(f"Submitting review {i+1}/{len(reviews)}: {response.status_code}")
    
    print("All peer reviews submitted successfully!")

def test_get_peer_reviews():
    response = requests.get(f"{BASE_URL}/api/peer-reviews/group/1/assignment/1")
    print("Get reviews response:", response.status_code)
    print(json.dumps(response.json(), indent=2))

def test_analyze_contributions():
    payload = {
        "group_id": 1,
        "assignment_id": 1
    }
    
    response = requests.post(f"{BASE_URL}/api/peer-reviews/analyze", json=payload)
    print("Analysis response:", response.status_code)
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    print("Begin testing unbalanced contribution scenarios...")
    test_submit_imbalanced_peer_reviews()
    test_get_peer_reviews()
    test_analyze_contributions()
    print("Test completed.!")