import requests

def get_latest_tag(repo_url: str = "https://github.com/stikkireddy/databricks-devbox", release: bool = True) -> str | None:
    """
    Get the latest tag from a GitHub repository.

    :param repo_url: Full GitHub repo URL (e.g., https://github.com/OWNER/REPO)
    :param release: If True, fetch the latest *release* tag instead of just tags.
    :return: Latest tag string or None if not found.
    """
    repo = "/".join(repo_url.rstrip("/").split("/")[-2:])
    if release:
        url = f"https://api.github.com/repos/{repo}/releases/latest"
        resp = requests.get(url)
        resp.raise_for_status()
        return resp.json().get("tag_name")
    else:
        url = f"https://api.github.com/repos/{repo}/tags"
        resp = requests.get(url)
        resp.raise_for_status()
        tags = resp.json()
        return tags[0]["name"] if tags else None
