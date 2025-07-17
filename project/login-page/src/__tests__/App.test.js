import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';
import '@testing-library/jest-dom';

// Mock Supabase createClient to prevent real network calls during testing
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
      auth: {
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    })),
  };
});

// Test suite for App component
describe('App', () => {
  // Test if the login page heading renders
  test('renders login page heading', () => {
    render(<App />); // No need for a <BrowserRouter>, and the app should internally wrap
    const headingElement = screen.getByText(/Sign in to your account/i);
    expect(headingElement).toBeInTheDocument();
  });
});
