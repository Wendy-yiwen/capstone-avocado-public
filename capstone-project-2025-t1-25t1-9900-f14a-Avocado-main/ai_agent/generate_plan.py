import os
import requests
import pdfplumber
from openai import OpenAI
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Initializing OpenAI
client = OpenAI(api_key=OPENAI_API_KEY)

# Factory functions for testing mock
def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Get PDF URL
def get_pdf_url(assignment_id, supabase_client):
    try:
        response = supabase_client.table("assignments").select("pdf_url").eq("id", assignment_id).single().execute()
        if response.data:
            pdf_url = response.data.get("pdf_url")
            if pdf_url:
                print(f"✅ Retrieved PDF URL: {pdf_url}")
                return pdf_url
            else:
                print(f"⚠️ Assignment ID {assignment_id} has no PDF URL.")
        else:
            print(f"❌ No assignment found with ID {assignment_id}.")
    except Exception as e:
        print(f"❌ Error fetching PDF URL: {e}")
    return None

# Get conference details
def get_meeting_details(meeting_id, supabase_client):
    response = supabase_client.table("meetings").select("*").eq("id", meeting_id).single().execute()
    if response.data:
        return response.data
    return None

# Extract PDF Text
def extract_text_from_pdf(pdf_url):
    print(f"📥 Downloading PDF: {pdf_url}")
    try:
        response = requests.get(pdf_url, stream=True, timeout=10)
        if response.status_code == 200:
            pdf_path = "temp.pdf"
            with open(pdf_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        f.write(chunk)
            text = ""
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            os.remove(pdf_path)
            print("✅ PDF Text Extraction Successful")
            return text
        else:
            print(f"❌ Download failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error downloading PDF: {e}")
        return None

# Generate meeting agendas
def generate_meeting_agenda(meeting_details, pdf_text):
    meeting_time = meeting_details["start_time"]
    prompt = f"Generate a meeting agenda for time {meeting_time} based on this document:\n\n{pdf_text}"
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    return completion.choices[0].message.content

# Storage agenda
def store_meeting_agenda(meeting_id, agenda, supabase_client):
    try:
        supabase_client.table("meetings").update({"agenda": agenda}).eq("id", meeting_id).execute()
        print("✅ Agenda stored in Supabase")
        return True
    except Exception as e:
        print(f"❌ Failed to store agenda: {e}")
        return False

# Main Function
def main(meeting_id, supabase_client=None):
    if not supabase_client:
        supabase_client = get_supabase_client()

    meeting_details = get_meeting_details(meeting_id, supabase_client)
    if not meeting_details:
        print("❌ Meeting not found")
        return

    pdf_url = get_pdf_url(meeting_details["assignment_id"], supabase_client)
    if not pdf_url:
        print("❌ PDF not found")
        return

    pdf_text = extract_text_from_pdf(pdf_url)
    if not pdf_text:
        print("❌ Failed to extract PDF text")
        return

    agenda = generate_meeting_agenda(meeting_details, pdf_text)
    store_meeting_agenda(meeting_id, agenda, supabase_client)
    print("✅ Meeting agenda generation complete")

# CLI
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python generate_plan.py <meeting_id>")
        sys.exit(1)
    main(int(sys.argv[1]))
