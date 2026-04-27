import os
import json
from sklearn.cluster import KMeans
import numpy as np
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import HumanMessage

load_dotenv()

# Initialize LangChain OpenAI Embeddings with UF Navigator settings
embeddings_model = OpenAIEmbeddings(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_API_BASE"),
    model="sfr-embedding-mistral",
    tiktoken_enabled=False,
    check_embedding_ctx_length=False
)

# Initialize ChatOpenAI LLM for gpt-oss-120b
llm = ChatOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_API_BASE"),
    model="gpt-oss-120b",
    temperature=0.1
)

# STEP 1: SCORING FUNCTION
# Score each comment by importance (upvotes + viewpoint diversity)

def calculate_score(comment_text: str, upvotes: int, max_upvotes: int) -> float:
    """
    Score a comment based on:
    1. Upvotes (popularity)
    2. Length (detailed comments are more valuable)

    Returns: score between 0-100
    """

    # PART 1: Upvote score (70% weight)
    # Normalize upvotes to 0-100
    upvote_score = (upvotes / max_upvotes) * 100 if max_upvotes > 0 else 0

    # PART 2: Comment length score (30% weight)
    # Longer, more detailed comments score higher
    word_count = len(comment_text.split())
    length_score = min((word_count / 50) * 100, 100)  # Cap at 100

    # COMBINE: 70% upvotes + 30% length
    final_score = (upvote_score * 0.7) + (length_score * 0.3)

    return round(final_score, 2)


def score_all_comments(comments: list) -> list:
    """
    Score all comments and return them ranked by importance.

    Args:
        comments: List of comment dictionaries with 'text', 'upvotes', 'author'

    Returns:
        List of comments with 'score' added, sorted by score descending
    """

    # Find the max upvotes to normalize scores
    max_upvotes = max([c["upvotes"] for c in comments]) if comments else 1

    # Score each comment
    scored_comments = []
    for comment in comments:
        score = calculate_score(comment["text"], comment["upvotes"], max_upvotes)
        comment["score"] = score  # Add score to comment
        scored_comments.append(comment)

    # Sort by score (highest first)
    scored_comments.sort(key=lambda x: x["score"], reverse=True)

    return scored_comments


# STEP 2: CLUSTERING FUNCTION
# Group similar comments together using embeddings + k-means

def get_embedding(text: str) -> list:
    """
    Convert text to embedding vector using LangChain OpenAI embeddings.

    Args:
        text: The comment text to embed

    Returns:
        A list of numbers representing the text's meaning
    """
    embedding = embeddings_model.embed_query(text)
    return embedding


def get_all_embeddings(comments: list) -> np.ndarray:
    """
    Get embeddings for all comments.

    Args:
        comments: List of comment dictionaries with 'text' key

    Returns:
        NumPy array of shape (num_comments, embedding_dim)
    """
    print("Getting embeddings for all comments...")
    embeddings = []

    for i, comment in enumerate(comments):
        print(f"  Embedding {i+1}/{len(comments)}: {comment['text'][:50]}...")
        embedding = get_embedding(comment["text"])
        embeddings.append(embedding)

    return np.array(embeddings)


def cluster_comments(comments: list, num_clusters: int = 3) -> dict:
    """
    Cluster comments by similarity using k-means.

    Args:
        comments: List of comments with 'text' and 'score' keys
        num_clusters: Number of clusters to create (how many viewpoints)

    Returns:
        Dictionary with cluster assignments and cluster info
    """
    # Get embeddings for all comments
    embeddings = get_all_embeddings(comments)

    # Apply k-means clustering
    print(f"\nClustering into {num_clusters} groups...")
    kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(embeddings)

    # Organize comments by cluster
    clustered = {}
    for i, label in enumerate(cluster_labels):
        if label not in clustered:
            clustered[label] = []
        clustered[label].append({
            **comments[i],
            "cluster": label
        })

    return {
        "clusters": clustered,
        "num_clusters": num_clusters,
        "cluster_centers": kmeans.cluster_centers_
    }


# STEP 3: SENTIMENT ANALYSIS
# Analyze the sentiment (positive/negative/neutral) of each cluster

def get_cluster_summary(comments: list) -> str:
    """
    Create a summary of all comments in a cluster to analyze sentiment.

    Args:
        comments: List of comment dictionaries in a cluster

    Returns:
        A paragraph summarizing the cluster's viewpoint
    """
    # Take top 3 highest-scoring comments to represent the cluster
    top_comments = sorted(comments, key=lambda x: x["score"], reverse=True)[:3]
    summary = " ".join([c["text"] for c in top_comments])
    return summary


def analyze_cluster_sentiment(cluster_comments: list) -> dict:
    """
    Analyze sentiment of a cluster using gpt-oss-120b.

    Args:
        cluster_comments: List of comments in the cluster

    Returns:
        Dictionary with sentiment and reasoning
    """
    summary = get_cluster_summary(cluster_comments)

    prompt = f"""Analyze the sentiment of this group of opinions about a policy:

"{summary}"

Respond ONLY with valid JSON in this format (no markdown, no extra text):
{{"sentiment": "positive" or "negative" or "neutral", "reason": "brief explanation"}}

If the comments are overall optimistic/supportive → positive
If the comments are overall critical/worried → negative
If the comments are balanced/neutral → neutral"""

    # Call gpt-oss-120b to analyze sentiment
    response = llm.invoke([HumanMessage(content=prompt)])
    response_text = response.content

    # Parse JSON response
    try:
        result = json.loads(response_text)
        return {
            "sentiment": result.get("sentiment", "neutral"),
            "reason": result.get("reason", ""),
            "summary": summary[:100] + "..."
        }
    except json.JSONDecodeError:
        return {
            "sentiment": "neutral",
            "reason": "Could not parse sentiment",
            "summary": summary[:100] + "..."
        }


def analyze_all_clusters_sentiment(clustered_data: dict) -> dict:
    """
    Analyze sentiment for all clusters.

    Args:
        clustered_data: Dictionary with clusters from cluster_comments()

    Returns:
        Dictionary with sentiment analysis for each cluster
    """
    print("\n=== STEP 3: ANALYZING SENTIMENT ===\n")

    clusters_with_sentiment = {}

    for cluster_id, comments in clustered_data["clusters"].items():
        print(f"Analyzing Cluster {cluster_id} ({len(comments)} comments)...")
        sentiment_result = analyze_cluster_sentiment(comments)
        clusters_with_sentiment[cluster_id] = {
            "comments": comments,
            "sentiment": sentiment_result["sentiment"],
            "reason": sentiment_result["reason"],
            "summary": sentiment_result["summary"]
        }

    return clusters_with_sentiment


# TEST THE PIPELINE
if __name__ == "__main__":
    from mock_data import MOCK_COMMENTS

    print("=== STEP 1: SCORING COMMENTS ===\n")
    scored = score_all_comments(MOCK_COMMENTS)

    for i, comment in enumerate(scored, 1):
        print(f"{i}. Score: {comment['score']}")
        print(f"   Upvotes: {comment['upvotes']}")
        print(f"   Text: {comment['text'][:60]}...")
        print()

    print("\n=== STEP 2: CLUSTERING COMMENTS ===\n")
    clustered = cluster_comments(scored, num_clusters=3)

    for cluster_id, comments_in_cluster in clustered["clusters"].items():
        print(f"\nCluster {cluster_id} ({len(comments_in_cluster)} comments):")
        for comment in comments_in_cluster:
            print(f"  - Score: {comment['score']} | {comment['text'][:60]}...")

    # STEP 3: SENTIMENT ANALYSIS
    sentiment_results = analyze_all_clusters_sentiment(clustered)

    for cluster_id, data in sentiment_results.items():
        print(f"\nCluster {cluster_id} Sentiment: {data['sentiment'].upper()}")
        print(f"  Reason: {data['reason']}")
        print(f"  Summary: {data['summary']}")
