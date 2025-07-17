import pytest
from unittest.mock import MagicMock
from ai_agent import generate_plan

@pytest.fixture
def mock_supabase():
    # Mock Supabase client
    mock_client = MagicMock()

    # Mock assignments table response
    mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "pdf_url": "http://example.com/fake.pdf"
    }

    # Mock meetings table response
    mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": 1,
        "assignment_id": 123,
        "start_time": "2025-04-15T10:00:00Z"
    }

    return mock_client

@pytest.fixture
def mock_extract_text(monkeypatch):
    # Mock PDF text extraction
    monkeypatch.setattr(generate_plan, "extract_text_from_pdf", lambda url: "This is some extracted text.")

@pytest.fixture
def mock_generate_agenda(monkeypatch):
    # Mock OpenAI agenda generation
    monkeypatch.setattr(generate_plan, "generate_meeting_agenda", lambda meeting, text: "Generated agenda.")

@pytest.fixture
def mock_store_agenda(monkeypatch):
    # Mock storing agenda
    monkeypatch.setattr(generate_plan, "store_meeting_agenda", lambda id, agenda, client: True)

def test_main_success(mock_supabase, mock_extract_text, mock_generate_agenda, mock_store_agenda):
    # Test the main function, no exception thrown means success
    generate_plan.main(meeting_id=1, supabase_client=mock_supabase)
