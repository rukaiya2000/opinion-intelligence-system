"""
UNIFIED ANALYSIS PIPELINE
Takes a Reddit URL, scrapes it, analyzes with LLM pipeline, returns structured output.
"""

from reddit_scraper import get_reddit_post_data
from pipeline import (
    score_all_comments,
    cluster_comments,
    analyze_all_clusters_sentiment,
    detect_main_debate,
    generate_structured_output
)
import json


def analyze_reddit_post(reddit_url: str) -> dict:
    """
    Complete pipeline: Scrape Reddit → Analyze → Return structured JSON.

    Args:
        reddit_url: Full Reddit post URL

    Returns:
        Final structured output with consensus, debate, viewpoints, etc.
    """

    print("\n" + "="*70)
    print("REDDIT OPINION ANALYSIS PIPELINE")
    print("="*70)

    # STEP 0: Scrape Reddit
    print("\n[0/5] SCRAPING REDDIT POST...")
    reddit_data = get_reddit_post_data(reddit_url)

    if not reddit_data:
        return {"error": "Failed to scrape Reddit post"}

    comments = reddit_data["comments"]

    if len(comments) < 3:
        return {"error": "Not enough comments to analyze (need at least 3)"}

    print(f"✅ Scraped {len(comments)} comments")
    print(f"📝 Post: {reddit_data['post_title'][:80]}...")

    # STEP 1: Score comments
    print("\n[1/5] SCORING COMMENTS...")
    scored_comments = score_all_comments(comments)
    print(f"✅ Scored {len(scored_comments)} comments")

    # STEP 2: Cluster comments
    print("\n[2/5] CLUSTERING COMMENTS...")
    # Determine number of clusters (3-5 based on comment count)
    num_clusters = min(5, max(3, len(comments) // 5))
    clustered = cluster_comments(scored_comments, num_clusters=num_clusters)
    print(f"✅ Created {num_clusters} clusters")

    # STEP 3: Analyze sentiment
    print("\n[3/5] ANALYZING SENTIMENT...")
    sentiment_results = analyze_all_clusters_sentiment(clustered)
    print(f"✅ Sentiment analysis complete")

    # STEP 4: Detect main debate
    print("\n[4/5] DETECTING MAIN DEBATE...")
    debate = detect_main_debate(sentiment_results)
    print(f"✅ Main debate: {debate['main_debate']}")

    # STEP 5: Generate output
    print("\n[5/5] GENERATING STRUCTURED OUTPUT...")
    final_output = generate_structured_output(sentiment_results, debate, clustered)
    print(f"✅ Analysis complete!")

    # Add metadata
    final_output["metadata"] = {
        "reddit_url": reddit_url,
        "post_title": reddit_data["post_title"],
        "total_comments_analyzed": len(scored_comments),
        "num_clusters": num_clusters
    }

    return final_output


if __name__ == "__main__":
    # Test with a real Reddit post
    reddit_url = "https://www.reddit.com/r/AskReddit/comments/1sqnwty/how_do_you_feel_about_the_fact_that_trump_is/"

    print("Starting analysis...")
    result = analyze_reddit_post(reddit_url)

    print("\n" + "="*70)
    print("FINAL ANALYSIS RESULT")
    print("="*70)
    print(json.dumps(result, indent=2))

    # Optional: Save to file
    with open("reddit_analysis_output.json", "w") as f:
        json.dump(result, f, indent=2)
    print("\n✅ Results saved to reddit_analysis_output.json")
