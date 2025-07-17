import subprocess
import os
import sys
import time
import signal

def run_command(command, cwd):
    """Run a command in the specified directory and return the subprocess."""
    try:
        print(f"Running command: {command} in {cwd}")
        process = subprocess.Popen(command, shell=True, cwd=cwd)
        return process
    except Exception as e:
        print(f"Error occurred while running the command: {e}")
        sys.exit(1)

def start_server():
    """Start the server."""
    server_dir = os.path.join(os.getcwd(), 'initialpage')  # Ensure the path is correct
    if not os.path.exists(server_dir):
        print(f"Directory {server_dir} does not exist.")
        sys.exit(1)

    return run_command('npm start', server_dir)

def start_client():
    """Start the client."""
    client_dir = os.path.join(os.getcwd(), 'login-page')  # Ensure the path is correct
    if not os.path.exists(client_dir):
        print(f"Directory {client_dir} does not exist.")
        sys.exit(1)

    return run_command('npm start', client_dir)

def stop_process(process):
    """Terminate the subprocess gracefully."""
    try:
        print("Stopping process...")
        process.terminate()  # Gracefully terminate the process
        process.wait()  # Wait for the process to finish termination
    except Exception as e:
        print(f"Error stopping the process: {e}")

def main():
    try:
        # Step 1: Start the server
        server_process = start_server()

        # Step 2: Wait for a short period to allow the server to start (adjust time as needed)
        time.sleep(5)

        # Step 3: Start the client
        client_process = start_client()

        # Wait for the server to complete (if necessary)
        server_process.wait()

    except KeyboardInterrupt:
        print("\nProcess interrupted. Stopping all processes...")
        # If Ctrl+C is pressed, terminate the server and client processes
        stop_process(server_process)
        stop_process(client_process)
        sys.exit(0)

    except Exception as e:
        print(f"An error occurred: {e}")
        stop_process(server_process)
        stop_process(client_process)
        sys.exit(1)

if __name__ == "__main__":
    main()
