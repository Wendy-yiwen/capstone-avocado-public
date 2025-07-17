import os
from dotenv import load_dotenv
from openai import OpenAI

# Loading environment variables
load_dotenv()

# Initializing the OpenAI Client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

try:
    # Testing API Calls
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": "Hello, are you working?"}
        ]
    )
    print("API Connection successful!")
    print("Response:", response.choices[0].message.content)
except Exception as e:
    print("API Connection successful!")
    print("Error Message:", str(e))