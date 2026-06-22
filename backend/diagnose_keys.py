"""
Quick diagnostic: test Gemini and Groq API keys for triage.
Run from the backend directory:
    python diagnose_keys.py
"""
import os, json, sys
from dotenv import load_dotenv
load_dotenv()

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")
GROQ_KEY   = os.getenv("GROQ_API_KEY",   "").strip().strip('"').strip("'")

print(f"\n--- GEMINI KEY ---")
print(f"  Set: {bool(GEMINI_KEY)}")
print(f"  Prefix (first 8 chars): {GEMINI_KEY[:8]!r}")
print(f"  Length: {len(GEMINI_KEY)}")
print(f"  Looks valid: {GEMINI_KEY.startswith('AIzaSy')}")

print(f"\n--- GROQ KEY ---")
print(f"  Set: {bool(GROQ_KEY)}")
print(f"  Prefix (first 8 chars): {GROQ_KEY[:8]!r}")
print(f"  Length: {len(GROQ_KEY)}")
print(f"  Looks valid: {GROQ_KEY.startswith('gsk_')}")

# Test Gemini
print("\n--- TESTING GEMINI ---")
try:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=GEMINI_KEY)
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents="Say OK in one word.",
        config=types.GenerateContentConfig(response_mime_type="text/plain"),
    )
    print(f"  ✅ Gemini OK: {response.text!r}")
except Exception as e:
    print(f"  ❌ Gemini FAILED: {type(e).__name__}: {e}")

# Test Groq
print("\n--- TESTING GROQ ---")
try:
    from groq import Groq
    client = Groq(api_key=GROQ_KEY)
    res = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Say OK in one word."}],
        max_tokens=5,
    )
    print(f"  ✅ Groq OK: {res.choices[0].message.content!r}")
except Exception as e:
    print(f"  ❌ Groq FAILED: {type(e).__name__}: {e}")

print("\nDone.")
