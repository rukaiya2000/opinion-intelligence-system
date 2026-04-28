import requests
import json

def get_reddit_post_data(post_url: str) -> dict:
    """
    Scrape a Reddit post and comments using the public JSON API.

    No authentication needed - Reddit provides JSON for public posts.

    Args:
        post_url: Full Reddit post URL (e.g., https://www.reddit.com/r/python/comments/xyz/...)

    Returns:
        Dictionary with post title, body, and top comments
    """

    # Convert URL to JSON API endpoint
    if not post_url.endswith('/'):
        post_url += '/'
    json_url = post_url + '.json'

    print(f"Fetching: {json_url}")

    headers = {
        'User-Agent': 'RedditAnalyzer/1.0'
    }

    try:
        response = requests.get(json_url, headers=headers, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching post: {e}")
        return None

    data = response.json()

    # Extract post data
    post_data = data[0]['data']['children'][0]['data']

    post_info = {
        "title": post_data.get("title", ""),
        "body": post_data.get("selftext", ""),
        "score": post_data.get("score", 0),
        "url": post_data.get("url", "")
    }

    # Extract comments
    comments_data = data[1]['data']['children']

    comments = []
    for comment in comments_data:
        if comment['kind'] == 't1':  # t1 = comment
            c_data = comment['data']

            # Skip deleted/removed comments
            if c_data.get('body') in ['[deleted]', '[removed]']:
                continue

            # Skip bot comments (optional - can configure)
            if c_data.get('author') in ['AutoModerator']:
                continue

            comments.append({
                "text": c_data.get('body', ''),
                "upvotes": c_data.get('score', 0),
                "author": c_data.get('author', 'unknown'),
                "created": c_data.get('created_utc', 0)
            })

    print(f"✅ Found {len(comments)} comments")

    return {
        "post_title": post_info["title"],
        "post_body": post_info["body"],
        "post_score": post_info["score"],
        "comments": comments
    }


if __name__ == "__main__":
    # Test with a real Reddit post
    test_url = "https://www.reddit.com/r/AskReddit/comments/1sqnwty/how_do_you_feel_about_the_fact_that_trump_is/"

    print("Testing Reddit scraper...\n")
    data = get_reddit_post_data(test_url)

    if data:
        print(f"\n📝 Post: {data['post_title']}")
        print(f"💬 Comments: {len(data['comments'])}")
        print("\nFirst 3 comments:")
        for comment in data['comments'][:3]:
            print(f"  - [{comment['upvotes']} upvotes] {comment['text'][:60]}...")
