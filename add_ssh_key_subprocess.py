import subprocess
import sys
import os

HOST = "51.38.133.209"
USERNAME = "ubuntu"
PASSWORD = "Szczerbacz25!"
SSH_KEY = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCf2CJa00U0i5ueNdugRfYn4pzTQ7H8QuNCxETirByorexaizOgCrNIyqDe4fhc2fsxw9ZVVIuSyNbb0v5q18b5kQmoOjXobn6u5mv2StjGFA7oaCCgKGkMPWqUwFtjG4YtBowtztoAw0zzL/4QxbIM0PsKEKm1TlDk5TKUjXPY9w/E5ISbgarB6CvDaHUrUdo3jpg3Kj2eTa19jgv/FO4boY0+9pcsJ57T2poiTYB7W1kufuwb7ps/oRiK24Crr2YwPzT4WJkb5MAMRsSA09zKMnWeHr9h7p2x0jfAWuynXs+kN/MMeWn0TNSyDFLc22k6DumEGDe3i5YCDsqJWpWUZekCImaQAMdhxV+sXRXKkdpxyhbluQHH8SWQLI+p0TxuJhkPcfpzG5mG6xIQk6KiQnq5IrmOkvZNlKt/fi2ee/c0u5wMHMwWDn5y90OommbV1co9f9mO/Jal16EH6fcGCqhTuFAsXpTYBLhv4dvgJn8lpmFxR4k8OlT5DHlYpwhClpxF4Y9c/84y6+BgItnRT740fD+HtNW8CqqmKfLeP59e4wNCi/YzdFugL7UURR8YAR5mjJuR1nv83iItQKN5wRIiqAabfarDuw6fP2BlJ8qZosDNEWZA7iTn/rJc7NDuAirY7DTNhwLhayJBhCVjlz2qhp24eVWfwnpoBOzZ2w== twin\tomasz.zarzycki@PF5RF55Y"

def run_ssh_command(cmd):
    """Run command via SSH"""
    try:
        # Using SSH with StrictHostKeyChecking disabled
        full_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", f"{USERNAME}@{HOST}", cmd]
        result = subprocess.run(full_cmd, capture_output=True, text=True, timeout=10)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except Exception as e:
        return 1, "", str(e)

print("="*60)
print("SSH Key Addition Script (subprocess)")
print("="*60)

# Commands to execute
commands = [
    ("mkdir -p ~/.ssh", "Creating .ssh directory"),
    (f'echo "{SSH_KEY}" >> ~/.ssh/authorized_keys', "Adding SSH key"),
    ("chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys", "Setting permissions"),
    ("tail -1 ~/.ssh/authorized_keys", "Verifying key"),
]

success = True
for cmd, desc in commands:
    print(f"[*] {desc}...")
    exitcode, stdout, stderr = run_ssh_command(cmd)
    if exitcode != 0:
        print(f"[-] Error: {stderr}")
        success = False
    else:
        if stdout:
            print(f"[+] Output: {stdout[:100]}")
        else:
            print(f"[+] {desc} successful")

print("="*60)
if success:
    print("[SUCCESS] SSH key has been added")
    sys.exit(0)
else:
    print("[FAILURE] SSH key addition had errors")
    sys.exit(1)
