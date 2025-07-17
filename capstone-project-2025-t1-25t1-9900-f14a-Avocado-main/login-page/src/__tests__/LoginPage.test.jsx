import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import '@testing-library/jest-dom';

// Test suite for LoginPage component
describe('LoginPage', () => {
  // Test if the login form renders correctly
  test('renders login form', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // Manually find the input box
    const usernameLabel = screen.getByText(/username/i);
    const usernameInput = usernameLabel.parentElement.querySelector('input');

    const passwordLabel = screen.getByText(/password/i);
    const passwordInput = passwordLabel.parentElement.querySelector('input');

    expect(usernameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
  });

  // Test if the user can input text into form fields
  test('allows user to type in form fields', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const usernameLabel = screen.getByText(/username/i);
    const usernameInput = usernameLabel.parentElement.querySelector('input');

    const passwordLabel = screen.getByText(/password/i);
    const passwordInput = passwordLabel.parentElement.querySelector('input');

    fireEvent.change(usernameInput, { target: { value: 'z1234567' } });
    fireEvent.change(passwordInput, { target: { value: 'password' } });

    expect(usernameInput.value).toBe('z1234567');
    expect(passwordInput.value).toBe('password');
  });
});
