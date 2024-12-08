from flask import Flask, request, jsonify, render_template
import yfinance as yf
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import requests
import json
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
from openai import OpenAI
import dotenv
import concurrent.futures
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.schema import Document
import os
from dotenv import load_dotenv
from flask_cors import CORS
os.environ["TOKENIZERS_PARALLELISM"] = "false"


# Load environment variables
load_dotenv('.env.local')

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Access API keys
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ALPHA_VAN_API = os.getenv("ALPHA_VAN_API")

# HuggingFace Embeddings Model
embedding_model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")

def get_stock_info(symbol):
    data = yf.Ticker(symbol)
    stock_info = data.info
    return {
        "Ticker": stock_info.get('symbol', 'N/A'),
        "Name": stock_info.get('longName', 'N/A'),
        "Business Summary": stock_info.get('longBusinessSummary', 'N/A'),
        "City": stock_info.get('city', 'N/A'),
        "State": stock_info.get('state', 'N/A'),
        "Country": stock_info.get('country', 'N/A'),
        "Industry": stock_info.get('industry', 'N/A'),
        "Sector": stock_info.get('sector', 'N/A')
    }

def get_huggingface_embeddings(text):
    return embedding_model.encode(text)





# OpenAI settings (for LLM querying)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = OpenAI(
  base_url="https://api.groq.com/openai/v1",
  api_key=GROQ_API_KEY
)
# openai.api_key = os.getenv("GROQ_API_KEY")

@app.route('/query-pinecone', methods=['POST'])
def query_pinecone():
    """
    Queries the Pinecone database and processes the response using an LLM.
    """
    try:
        # Extract query parameters
        data = request.json
        user_query = data.get("query", "")
        top_k = int(data.get("top_k", 10))
        
        # Generate query embedding
        model_name = "sentence-transformers/all-mpnet-base-v2"
        embedding_model = SentenceTransformer(model_name)
        query_embedding = embedding_model.encode(user_query).tolist()
        pc = Pinecone(PINECONE_API_KEY)
        # Query Pinecone
        index =pc.Index("stocks")
        results = index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True,
            namespace="stocks"
        )
        
        # Extract and structure results
        matches = results.get('matches', [])
        contexts = [
            {**match['metadata']} for match in matches
        ]
        
        # Augment the query for LLM
        contexts_str = "\n\n-------\n\n".join(
            "\n".join(f"{key}: {value}" for key, value in context.items()) for context in contexts[:5]
        )
        augmented_query = f"<CONTEXT>\n{contexts_str}\n</CONTEXT>\n\nMY QUESTION:\n{user_query}"

        # Query LLM
        system_prompt = (
            "You are an expert in financial stock analysis. Use the given context to "
            "answer the question provided in the format:\n\n"
            "<Company Name> (<Ticker>): <Answer>"
        )
        
        llm_response = client.chat.completions.create(
            model="llama-3.1-70b-versatile",  # Adjust to your available model
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": augmented_query}
            ]
        )
        
        # Extract the LLM's response
        llm_answer = llm_response.choices[0].message.content
        
        return jsonify({
            "query": user_query,
            "pinecone_results": contexts,
            "llm_response": llm_answer
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/stock-info', methods=['POST'])
def stock_info():
    # Extract query parameters
    data = request.json
    symbol = data.get("symbol", "")
    info = get_stock_info(symbol)
    return jsonify(info)

def plot_stock_data(df, tickers, price_type='Close'):
    fig = go.Figure()
    for ticker in tickers:
        fig.add_trace(go.Scatter(
            x=df.index,
            y=df[(price_type, ticker)],
            mode='lines',
            name=ticker,
            hovertemplate=f"<b>{ticker}</b><br>Date: %{{x}}<br>{price_type} Price: $%{{y:.2f}}<extra></extra>"
        ))
    fig.update_layout(
        title=f"Interactive {price_type} Prices Over Time",
        xaxis_title="Date",
        yaxis_title=f"{price_type} Price ($)",
        hovermode="x unified",
        legend_title="Stocks",
        template="plotly_dark"  # Optional: Use a dark theme
    )
    fig.show()
    return fig.to_html(full_html=False)

@app.route('/plot', methods=['POST'])
def plot():
    data = request.json
    tickers = data.get('tickers', [])
    price_type = data.get('price_type', 'Close')
    df = yf.download(tickers, period="10y")
    df.columns = pd.MultiIndex.from_tuples(df.columns) if not isinstance(df.columns, pd.MultiIndex) else df.columns
    df.index = pd.to_datetime(df.index)
    tickers = df.columns.get_level_values(1).unique()
    plot_html = plot_stock_data(df, tickers, price_type)
    return plot_html

@app.route('/news-sentiment', methods=['GET'])
def news_sentiment():
    url = f'https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=TSLA&limit=100&apikey={ALPHA_VAN_API}'
    r = requests.get(url)
    data = r.json()
    structured_data = []
    for entry in data['feed']:
        base_info = {
            'title': entry['title'],
            'url': entry['url'],
            'time_published': entry['time_published'],
            'overall_sentiment_score': entry['overall_sentiment_score'],
            'overall_sentiment_label': entry['overall_sentiment_label'],
        }
        # Extract ticker details
        for ticker_info in entry.get('ticker_sentiment', []):
            detailed_info = base_info.copy()
            detailed_info.update({
                'ticker': ticker_info['ticker'],
                'ticker_relevance_score': ticker_info['relevance_score'],
                'ticker_sentiment_score': ticker_info['ticker_sentiment_score'],
                'ticker_sentiment_label': ticker_info['ticker_sentiment_label'],
            })
            structured_data.append(detailed_info)

    # Convert to DataFrame for better visualization
    df = pd.DataFrame(structured_data)

    # Sort by relevance score in descending order
    df_sorted = df.sort_values(by='ticker_relevance_score', ascending=False)

    # Get the top 10 entries
    top_df = df_sorted.head(35)
    system_prompt = f"""You are an expert at providing stock predictions and if its a good stock to buy or sell. Please answer my question provided.
    example format -

    <Example>
    Here are the top stocks to buy and sell based on the provided article summaries:

            **Best to Buy:**

            1. **Tesla (TSLA)** - BUY: Tesla's stock has been experiencing a surge in recent months, and analysts are predicting it will continue to rise due to its strong sales and innovative technology.
            2. **Credo Technology Group (CRDO)** - BUY: Credo Technology Group's AI play is being double-upgraded, with a forecast increase of almost 200%, making it a promising investment opportunity.
            3. **SOFI (SOFI)** - BUY: SOFI's stock is flashing bullish momentum, making it a good opportunity to buy.
            4. **Amazon (AMZN)** - BUY: Amazon's stock is part of the "Magnificent Seven" and is expected to perform well, making it a good investment opportunity.
            5. **NVIDIA (NVDA)** - BUY: NVIDIA's stock is part of the "Magnificent Seven" and is expected to perform well, making it a good investment opportunity.

            **Best to Sell:**

            1. **Tesla (TSLA)** - SELL (Contrarian): Some analysts are predicting a decline in Tesla's global sales due to a slowdown in Europe and the US, making it a good opportunity to sell.
            2. **Meta Platforms (META)** - SELL: Meta's stock is experiencing a decline due to concerns about its content moderation and misinformation, making it a good opportunity to sell.

            **Neutral Stocks:**

            1. **ChargePoint Holdings (CHPT)** - NEUTRAL: ChargePoint's stock is neither considered a strong buy or sell, as it's expected to take years for it to turn a profit.
            2. **CrowdStrike Holdings (CRWD)** - NEUTRAL: CrowdStrike's stock is neither considered a strong buy or sell, as it's expected to have neutral momentum.
            3. **MicroStrategy (MSTR)** - NEUTRAL: MicroStrategy's stock is experiencing some hiccups, but overall, its momentum is neutral.



        <Example/>
    order by best to buy followed by best to sell.
    list top 10 urls at bottom
    """

    # Convert DataFrame to string
    formatted_string = top_df.to_string(index=False)
    query = formatted_string
    llm_response = client.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ]
    )

    response = llm_response.choices[0].message.content
    
    return jsonify(response)



if __name__ == '__main__':
    app.run(debug=True)
