import requests

BASE_URL = "http://localhost:5003"  # remain unchanged

group_id = 3
assignment_id = 1

print(f"Request analysis Group {group_id} 's Assignment {assignment_id}...\n")

# 1️⃣ Initiation of requests for analysis
res = requests.post(f"{BASE_URL}/api/peer-reviews/analyze", json={
    "group_id": group_id,
    "assignment_id": assignment_id
})

print("Analyzing Response Status:", res.status_code)

if res.status_code == 200:
    analysis = res.json()
    print("\nAnalysis Result:")
    print(analysis)
else:
    print("Error:", res.text)

# 2️⃣ (Optional) Access to historical analysis records
res2 = requests.get(f"{BASE_URL}/api/peer-reviews/analysis-results/{group_id}/{assignment_id}")
if res2.status_code == 200:
    print("\nAnalyzed records already in the database:")
    print(res2.json())
