import requests

BASE_URL = "http://localhost:5003"

print("\n📝 Submitting peer reviews...")
reviews = [
    {"group_id": 3, "assignment_id": 1, "reviewer_zid": "z5527858", "reviewee_zid": "z5555555", "score": 9, "comment": "Very responsive and quick"},
    {"group_id": 3, "assignment_id": 1, "reviewer_zid": "z5527858", "reviewee_zid": "z5325799", "score": 2, "comment": "Rarely contributed"},
    {"group_id": 3, "assignment_id": 1, "reviewer_zid": "z5555555", "reviewee_zid": "z5527858", "score": 8, "comment": "Did okay"},
    {"group_id": 3, "assignment_id": 1, "reviewer_zid": "z5555555", "reviewee_zid": "z5325799", "score": 7, "comment": "Some contributions"},
    {"group_id": 3, "assignment_id": 1, "reviewer_zid": "z5325799", "reviewee_zid": "z5527858", "score": 9, "comment": "Helpful and consistent"},
    {"group_id": 3, "assignment_id": 1, "reviewer_zid": "z5325799", "reviewee_zid": "z5555555", "score": 9, "comment": "Worked hard"},
]

for review in reviews:
    res = requests.post(f"{BASE_URL}/api/peer-reviews", json=review)
    print(f"Submitted review: {review['reviewer_zid']} -> {review['reviewee_zid']}")
    print("Status:", res.status_code)
    print("Response:", res.text)
