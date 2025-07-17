import requests
import json

BASE_URL = "http://localhost:5003"
group_id = 3
assignment_id = 1

print("\n📄 Fetching latest contribution analysis result...")
res = requests.get(f"{BASE_URL}/api/peer-reviews/analysis-results/group/{group_id}/assignment/{assignment_id}")

if res.status_code == 200:
    data = res.json().get("data", [])
    if not data:
        print("⚠️ No analysis record found.")
    else:
        latest = data[-1]  # Fetch the most recent analysis
        print("\n✅ Latest analysis result:")
        print(json.dumps(latest, indent=2))
else:
    print("❌ Request failed:", res.status_code)
    print(res.text)
