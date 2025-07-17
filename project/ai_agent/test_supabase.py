import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

# Get Supabase credentials from .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file")

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Test connection by fetching some data
def test_supabase_connection():
    try:
        # Try fetching first 5 rows from `assignments` table
        response = supabase.table("assignments").select("*").limit(5).execute()
        
        # Print the full response to check the structure
        print("🔹 Full API Response:", response)

        # Correct way to check for errors
        if hasattr(response, "data") and response.data is None:
            print("❌ Connection failed: No data returned")
        elif hasattr(response, "status_code") and response.status_code >= 400:
            print(f"❌ API Error (Status {response.status_code}): {response.json()}")
        else:
            print("✅ Successfully connected to Supabase!")
            print("🔹 Sample Data from `assignments` table:")
            for row in response.data:
                print(row)

    except Exception as e:
        print("❌ Error while connecting to Supabase:", str(e))

# Run test
if __name__ == "__main__":
    test_supabase_connection()
