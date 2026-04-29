#!/usr/bin/env python
"""
Script to add SSH public key to remote Linux server using paramiko
"""

import paramiko
import sys
import os

# Configuration
HOST = '51.38.133.209'
USERNAME = 'ubuntu'
PASSWORD = 'Szczerbacz25!'
SSH_KEY = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCf2CJa00U0i5ueNdugRfYn4pzTQ7H8QuNCxETirByorexaizOgCrNIyqDe4fhc2fsxw9ZVVIuSyNbb0v5q18b5kQmoOjXobn6u5mv2StjGFA7oaCCgKGkMPWqUwFtjG4YtBowtztoAw0zzL/4QxbIM0PsKEKm1TlDk5TKUjXPY9w/E5ISbgarB6CvDaHUrUdo3jpg3Kj2eTa19jgv/FO4boY0+9pcsJ57T2poiTYB7W1kufuwb7ps/oRiK24Crr2YwPzT4WJkb5MAMRsSA09zKMnWeHr9h7p2x0jfAWuynXs+kN/MMeWn0TNSyDFLc22k6DumEGDe3i5YCDsqJWpWUZekCImaQAMdhxV+sXRXKkdpxyhbluQHH8SWQLI+p0TxuJhkPcfpzG5mG6xIQk6KiQnq5IrmOkvZNlKt/fi2ee/c0u5wMHMwWDn5y90OommbV1co9f9mO/Jal16EH6fcGCqhTuFAsXpTYBLhv4dvgJn8lpmFxR4k8OlT5DHlYpwhClpxF4Y9c/84y6+BgItnRT740fD+HtNW8CqqmKfLeP59e4wNCi/YzdFugL7UURR8YAR5mjJuR1nv83iItQKN5wRIiqAabfarDuw6fP2BlJ8qZosDNEWZA7iTn/rJc7NDuAirY7DTNhwLhayJBhCVjlz2qhp24eVWfwnpoBOzZ2w== twin\tomasz.zarzycki@PF5RF55Y'

def add_ssh_key_to_remote():
    """Connect to remote server and add SSH key"""
    ssh = None
    try:
        # Create SSH client
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        print(f"[*] Connecting to {USERNAME}@{HOST}...")
        ssh.connect(HOST, username=USERNAME, password=PASSWORD, timeout=10)
        print("[+] Successfully connected")
        
        # Create .ssh directory if it doesn't exist
        print("[*] Creating ~/.ssh directory if needed...")
        stdin, stdout, stderr = ssh.exec_command('mkdir -p ~/.ssh')
        exit_code = stdout.channel.recv_exit_status()
        if exit_code != 0:
            error_msg = stderr.read().decode()
            print(f"[-] Error creating .ssh directory: {error_msg}")
            return False
        print("[+] .ssh directory ensured")
        
        # Check if the key already exists
        print("[*] Checking if key already exists...")
        stdin, stdout, stderr = ssh.exec_command('grep -F "twin\tomasz.zarzycki" ~/.ssh/authorized_keys 2>/dev/null')
        exit_code = stdout.channel.recv_exit_status()
        
        if exit_code == 0:
            print("[!] SSH key already exists in authorized_keys")
            return True
        
        # Append the SSH key to authorized_keys
        print("[*] Adding SSH key to authorized_keys...")
        cmd = f'echo "{SSH_KEY}" >> ~/.ssh/authorized_keys'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        exit_code = stdout.channel.recv_exit_status()
        
        if exit_code != 0:
            error_msg = stderr.read().decode()
            print(f"[-] Error adding SSH key: {error_msg}")
            return False
        
        print("[+] SSH key successfully added to authorized_keys")
        
        # Set correct permissions
        print("[*] Setting correct permissions on .ssh and authorized_keys...")
        stdin, stdout, stderr = ssh.exec_command('chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys')
        exit_code = stdout.channel.recv_exit_status()
        
        if exit_code != 0:
            error_msg = stderr.read().decode()
            print(f"[-] Error setting permissions: {error_msg}")
            return False
        
        print("[+] Permissions set correctly")
        
        # Verify the key was added
        print("[*] Verifying SSH key was added...")
        stdin, stdout, stderr = ssh.exec_command('tail -1 ~/.ssh/authorized_keys')
        output = stdout.read().decode().strip()
        
        if "ssh-rsa" in output and "twin" in output:
            print("[+] SSH key verification successful!")
            print(f"[+] Last line in authorized_keys: {output[:60]}...")
            return True
        else:
            print("[-] SSH key verification failed")
            return False
        
    except paramiko.AuthenticationException as e:
        print(f"[-] Authentication failed: {e}")
        return False
    except paramiko.SSHException as e:
        print(f"[-] SSH error: {e}")
        return False
    except Exception as e:
        print(f"[-] Error: {e}")
        return False
    finally:
        if ssh:
            ssh.close()
            print("[*] SSH connection closed")

if __name__ == "__main__":
    print("="*60)
    print("SSH Key Addition Script")
    print("="*60)
    
    success = add_ssh_key_to_remote()
    
    print("="*60)
    if success:
        print("[SUCCESS] SSH key has been added to the remote server")
        sys.exit(0)
    else:
        print("[FAILURE] Failed to add SSH key to the remote server")
        sys.exit(1)
