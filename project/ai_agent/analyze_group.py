import requests

BASE_URL = "http://localhost:5003"
group_id = 3
assignment_id = 1

print("\n🚀 Triggering AI contribution analysis...")
res = requests.post(f"{BASE_URL}/api/peer-reviews/analyze", json={
    "group_id": group_id,
    "assignment_id": assignment_id
})

print("Analysis status:", res.status_code)
print("Analysis result:")
print(res.json())
