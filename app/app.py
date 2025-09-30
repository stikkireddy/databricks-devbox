#!/usr/bin/env python3
"""
Simple, robust Python wrapper to run the Go-based Databricks Devbox.

This script starts the Go binary and runs indefinitely on port 8005.
Uses simpler signal handling to avoid recursive cleanup issues.
"""

import os
import sys
import platform
import urllib.request
import stat
import tarfile
import shutil
import zipfile
from pathlib import Path
from version import get_latest_tag


def get_platform_binary_name() -> str:
    """Get the platform-specific binary name."""
    system = platform.system().lower()
    machine = platform.machine().lower()

    # Map Python's platform names to Go's GOOS/GOARCH
    if system == "darwin":
        goos = "darwin"
        if machine in ["arm64", "aarch64"]:
            goarch = "arm64"
        else:
            goarch = "amd64"  # Fallback for Intel Macs
    elif system == "linux":
        goos = "linux"
        if machine in ["arm64", "aarch64"]:
            goarch = "arm64"
        else:
            goarch = "amd64"
    elif system == "windows":
        goos = "windows"
        goarch = "amd64"  # Most common on Windows
        return f"databricks-devbox-{goos}-{goarch}.exe"
    else:
        # Unknown platform, try generic binary
        return "databricks-devbox"

    return f"databricks-devbox-{goos}-{goarch}"


def get_code_server_platform() -> tuple[str, str]:
    """Get the platform-specific info for code-server downloads."""
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "darwin":
        os_name = "darwin"
        if machine in ["arm64", "aarch64"]:
            arch = "arm64"
        else:
            arch = "amd64"
    elif system == "linux":
        os_name = "linux"
        if machine in ["arm64", "aarch64"]:
            arch = "arm64"
        else:
            arch = "amd64"
    else:
        # Fallback to linux amd64 for unsupported platforms
        os_name = "linux"
        arch = "amd64"

    return os_name, arch


def is_databricks_cli_installed() -> bool:
    """Check if databricks CLI is already installed and in PATH."""
    return shutil.which("databricks") is not None


def get_databricks_cli_platform() -> tuple[str, str]:
    """Get the platform-specific info for databricks CLI downloads."""
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "darwin":
        os_name = "darwin"
        if machine in ["arm64", "aarch64"]:
            arch = "arm64"
        else:
            arch = "amd64"
    elif system == "linux":
        os_name = "linux"
        if machine in ["arm64", "aarch64"]:
            arch = "arm64"
        else:
            arch = "amd64"
    elif system == "windows":
        os_name = "windows"
        arch = "amd64"  # Most common on Windows
    else:
        # Fallback to linux amd64 for unsupported platforms
        os_name = "linux"
        arch = "amd64"

    return os_name, arch


def install_databricks_cli(version: str = "v0.270.0") -> bool:
    """Install Databricks CLI by downloading from GitHub releases."""
    if is_databricks_cli_installed():
        print("databricks CLI is already installed")
        return True

    print(f"Installing Databricks CLI {version}...")

    home = Path.home()
    local_lib = home / ".local" / "lib"
    local_bin = home / ".local" / "bin"

    # Create directories
    local_lib.mkdir(parents=True, exist_ok=True)
    local_bin.mkdir(parents=True, exist_ok=True)

    os_name, arch = get_databricks_cli_platform()

    # Handle different file extensions based on platform
    if os_name == "windows":
        filename = f"databricks_cli_{version[1:]}_windows_{arch}.zip"
        binary_name = "databricks.exe"
    else:
        filename = f"databricks_cli_{version[1:]}_{os_name}_{arch}.tar.gz"
        binary_name = "databricks"

    url = f"https://github.com/databricks/cli/releases/download/{version}/{filename}"

    try:
        # Download the archive
        print(f"Downloading from {url}...")
        archive_path = local_lib / filename
        urllib.request.urlretrieve(url, archive_path)

        # Extract the archive
        print(f"Extracting {filename}...")
        target_dir = local_lib / f"databricks-cli-{version}"

        if os_name == "windows":
            with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                zip_ref.extractall(target_dir)
        else:
            with tarfile.open(archive_path, 'r:gz') as tar:
                tar.extractall(target_dir)

        # Find the databricks binary in extracted files
        databricks_binary = None
        for root, _, files in os.walk(target_dir):
            if binary_name in files:
                databricks_binary = Path(root) / binary_name
                break

        if not databricks_binary:
            print(f"Could not find {binary_name} in extracted files")
            return False

        # Copy binary to local bin
        target_binary = local_bin / "databricks"
        if os_name == "windows":
            target_binary = local_bin / "databricks.exe"

        shutil.copy2(databricks_binary, target_binary)

        # Make binary executable (Unix-like systems)
        if os_name != "windows":
            target_binary.chmod(stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)

        # Clean up
        archive_path.unlink()
        shutil.rmtree(target_dir)

        # Add local bin to PATH
        current_path = os.environ.get('PATH', '')
        local_bin_str = str(local_bin)
        if local_bin_str not in current_path:
            os.environ['PATH'] = f"{local_bin_str}:{current_path}"

        print(f"Databricks CLI {version} installed successfully")
        print(f"Binary location: {target_binary}")
        print(f"Added to PATH: {local_bin_str}")

        return True

    except Exception as e:
        print(f"Failed to install Databricks CLI: {e}")
        return False


def is_code_server_installed() -> bool:
    """Check if code-server is already installed and in PATH."""
    return shutil.which("code-server") is not None


def install_code_server(version: str = "v4.104.1") -> bool:
    """Install code-server using pure Python if not already installed."""
    if is_code_server_installed():
        print("code-server is already installed")
        return True

    print(f"Installing code-server {version}...")

    home = Path.home()
    local_lib = home / ".local" / "lib"
    local_bin = home / ".local" / "bin"

    # Create directories
    local_lib.mkdir(parents=True, exist_ok=True)
    local_bin.mkdir(parents=True, exist_ok=True)

    os_name, arch = get_code_server_platform()
    filename = f"code-server-{version}-{os_name}-{arch}.tar.gz"
    url = f"https://github.com/coder/code-server/releases/download/v{version}/{filename}"

    try:
        # Download the tarball
        print(f"Downloading from {url}...")
        tarball_path = local_lib / filename
        urllib.request.urlretrieve(url, tarball_path)

        # Extract the tarball
        print(f"Extracting {filename}...")
        with tarfile.open(tarball_path, 'r:gz') as tar:
            tar.extractall(local_lib)

        # Move extracted directory to standard name
        extracted_dir = local_lib / f"code-server-{version}-{os_name}-{arch}"
        target_dir = local_lib / f"code-server-{version}"

        if extracted_dir.exists():
            if target_dir.exists():
                shutil.rmtree(target_dir)
            extracted_dir.rename(target_dir)

        # Make binary executable
        code_server_binary = target_dir / "bin" / "code-server"
        code_server_binary.chmod(stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)

        # Clean up tarball
        tarball_path.unlink()

        # Add code-server bin directory to PATH
        current_path = os.environ.get('PATH', '')
        code_server_bin_str = str(target_dir / "bin")
        if code_server_bin_str not in current_path:
            os.environ['PATH'] = f"{code_server_bin_str}:{current_path}"

        print(f"code-server {version} installed successfully")
        print(f"Binary location: {code_server_binary}")
        print(f"Added to PATH: {code_server_bin_str}")

        return True

    except Exception as e:
        print(f"Failed to install code-server: {e}")
        return False


def download_binary_from_github(version: str, binary_name: str, target_path: Path) -> bool:
    """Download binary from GitHub releases."""
    url = f"https://github.com/stikkireddy/databricks-devbox/releases/download/{version}/{binary_name}"

    try:
        print(f"Downloading binary from {url}...")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, target_path)

        # Make the binary executable
        target_path.chmod(stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
        print(f"Downloaded and made executable: {target_path}")
        return True
    except Exception as e:
        print(f"Failed to download binary: {e}")
        return False

def find_binary(is_databricks_app_deployment: bool) -> str:
    """Find the Go binary, prioritizing GitHub releases if version is set."""
    current_dir = Path(__file__).parent.parent
    platform_binary_name = get_platform_binary_name()

    # Check for version environment variable
    version = os.environ.get('LHA_SERVER_VERSION', None)
    if version is None:
        version = get_latest_tag()

    if version and is_databricks_app_deployment is True:
        # Try to download from GitHub releases first
        downloaded_binary = current_dir / "build" / platform_binary_name

        # Only download if the binary doesn't exist or version changed
        should_download = True
        version_file = current_dir / "build" / ".version"

        if downloaded_binary.exists() and version_file.exists():
            try:
                with open(version_file, 'r') as f:
                    cached_version = f.read().strip()
                if cached_version == version:
                    should_download = False
                    print(f"Using cached binary for version {version}: {downloaded_binary}")
            except:
                pass

        if should_download:
            if download_binary_from_github(version, platform_binary_name, downloaded_binary):
                # Save version info
                try:
                    with open(version_file, 'w') as f:
                        f.write(version)
                except:
                    pass
                return str(downloaded_binary)
            else:
                print("Failed to download from GitHub, falling back to local binaries...")
        else:
            return str(downloaded_binary)

    # Fallback to local binaries (existing logic)

    # Try platform-specific binary in build directory first
    platform_binary = current_dir / "build" / platform_binary_name
    if platform_binary.exists():
        return str(platform_binary)

    # Fallback: Look for generic binary in build directory
    build_binary = current_dir / "build" / "databricks-devbox"
    if build_binary.exists():
        return str(build_binary)

    # Fallback: Look for the binary in databricks_devbox_go directory
    go_dir_binary = current_dir / "databricks_devbox_go" / "databricks-devbox"
    if go_dir_binary.exists():
        return str(go_dir_binary)

    # Fallback: Look in current directory
    current_binary = current_dir / "databricks-devbox"
    if current_binary.exists():
        return str(current_binary)

    # Enhanced error message
    error_msg = f"Go binary not found. Tried:\n"
    if version is not None:
        error_msg += f"  - GitHub release {version}: {platform_binary_name}\n"
    error_msg += f"  - build/{platform_binary_name}\n"
    error_msg += f"  - build/databricks-devbox\n"
    error_msg += f"  - databricks_devbox_go/databricks-devbox\n"
    error_msg += f"\nOptions:\n"
    error_msg += f"  - Set LHA_SERVER_VERSION environment variable (e.g., '0.1.0')\n"
    error_msg += f"  - Or build locally: make build-go or make build-all"

    raise FileNotFoundError(error_msg)


def main():
    """Main entry point."""
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help']:
        print(__doc__)
        print("\nUsage: python go_server_runner_simple.py")
        print("\nThis will start the Go-based Databricks Devbox Manager Server on port 8000")
        print("\nEnvironment Variables:")
        print("  LHA_SERVER_VERSION     - Version to download from GitHub releases (e.g., '0.1.0')")
        print("                          If not set, will use local binaries")
        print("  DEVBOX_SERVER_PORT        - Port to run the server on (default: 8000)")
        print("  CODE_SERVER_VERSION    - Version of code-server to install (default: v4.104.1)")
        return 0

    # Install code-server if not already available
    code_server_version = os.environ.get('CODE_SERVER_VERSION', '4.104.1')
    install_code_server(code_server_version)

    # Install databricks CLI if not already available
    install_databricks_cli()

    is_databricks_app_deployment = os.environ.get("DATABRICKS_APP_DEPLOYMENT", "false") == "true"
    # Set config file path for the Go binary
    binary_path = find_binary(is_databricks_app_deployment)
    databricks_app_port = os.environ.get("PORT", "8000")
    port = os.environ.get('DEVBOX_SERVER_PORT', databricks_app_port)
    print(f"Starting Databricks Devbox Manager Server(Go version) from: {binary_path}")
    print(f"Server will run on port {port}")
    print("Press Ctrl+C to stop the server")

    # Set the port environment variable for the Go binary
    if is_databricks_app_deployment is True:
        from vibe_code import setup_node_and_vibe_coding_tools
        
        setup_node_and_vibe_coding_tools()

    env = os.environ.copy()
    env['DEVBOX_SERVER_PORT'] = port
    env['PATH'] = f"{env['PATH']}:/app/python/source_code/.venv/bin/"

    # Set config file path for the Go binary
    config_path = os.path.join(os.path.dirname(__file__), "devbox.yaml")
    if os.path.exists(config_path):
        env['DEVBOX_CONFIG_PATH'] = config_path
        print(f"Using config file: {config_path}")
    else:
        print(f"Warning: Config file not found at {config_path}, Go binary will use defaults")

    env.pop("PORT", None)
    try:
        print("\nNow starting the actual Go server...")

        # Simple approach: just exec the Go binary directly
        # This replaces the current Python process with the Go process
        # No signal handling complexity needed
        os.execve(binary_path, [binary_path], env)

    except FileNotFoundError:
        print(f"Error: Go binary not found at {binary_path}")
        print("Make sure to build the Go server first:")
        print("  make build-go")
        return 1
    except Exception as e:
        print(f"Error starting Go server: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())