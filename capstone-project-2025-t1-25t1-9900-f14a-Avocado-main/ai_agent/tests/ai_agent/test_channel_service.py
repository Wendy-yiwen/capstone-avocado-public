import pytest
from unittest.mock import MagicMock
from ai_agent.channel_service import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def mock_supabase(mocker):
    mock_supabase = MagicMock()
    mocker.patch('ai_agent.channel_service.supabase', mock_supabase)
    return mock_supabase

def test_get_channels(client, mock_supabase):
    # Mock Supabase return to the list of fake channels
    mock_supabase.table.return_value.select.return_value.execute.return_value.data = [
        {'id': 1, 'name': 'General'},
        {'id': 2, 'name': 'Random'}
    ]

    response = client.get('/api/channels')
    assert response.status_code == 200
    assert response.get_json()['data'] == [
        {'id': 1, 'name': 'General'},
        {'id': 2, 'name': 'Random'}
    ]

def test_create_channel(client, mock_supabase):
    # Mock Supabase Insert Returns (list form)
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.insert.return_value.execute.return_value.data = [
        {'id': 3, 'name': 'NewChannel', 'created_by': 'z1234567'}
    ]

    response = client.post('/api/channels', json={'name': 'NewChannel', 'created_by': 'z1234567'})
    assert response.status_code == 200
    assert response.get_json()['data'] == [  # Change to list here
        {'id': 3, 'name': 'NewChannel', 'created_by': 'z1234567'}
    ]