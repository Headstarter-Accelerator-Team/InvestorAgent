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
            model="llama-3.1-8b-instant",  # Adjust to your available model
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
    # url = f'https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=TSLA&limit=100&apikey={ALPHA_VAN_API}'
    # r = requests.get(url)
    # data = r.json()
    # structured_data = []
    # for entry in data['feed']:
    #     base_info = {
    #         'title': entry['title'],
    #         'url': entry['url'],
    #         'time_published': entry['time_published'],
    #         'overall_sentiment_score': entry['overall_sentiment_score'],
    #         'overall_sentiment_label': entry['overall_sentiment_label'],
    #     }
    #     # Extract ticker details
    #     for ticker_info in entry.get('ticker_sentiment', []):
    #         detailed_info = base_info.copy()
    #         detailed_info.update({
    #             'ticker': ticker_info['ticker'],
    #             'ticker_relevance_score': ticker_info['relevance_score'],
    #             'ticker_sentiment_score': ticker_info['ticker_sentiment_score'],
    #             'ticker_sentiment_label': ticker_info['ticker_sentiment_label'],
    #         })
    #         structured_data.append(detailed_info)

    # # Convert to DataFrame for better visualization
    # df = pd.DataFrame(structured_data)

    # # Sort by relevance score in descending order
    # df_sorted = df.sort_values(by='ticker_relevance_score', ascending=False)

    # # Get the top 10 entries
    # top_df = df_sorted.head(35)
    system_prompt = """
    You are an expert in analyzing stock-related news and predicting whether stocks are good to buy, sell, or hold. Based on the provided article summaries and sentiment data, categorize the stocks into three groups: `best_to_buy`, `best_to_sell`, and `neutral_stocks`.

    Respond strictly in JSON format with the following structure:
    {
        "best_to_buy": [
            {
                "stock": "<Stock Name>",
                "ticker": "<Ticker>",
                "reason": "<Short explanation based on the sentiment data and context>"
            },
            ...
        ],
        "best_to_sell": [
            {
                "stock": "<Stock Name>",
                "ticker": "<Ticker>",
                "reason": "<Short explanation based on the sentiment data and context>"
            },
            ...
        ],
        "neutral_stocks": [
            {
                "stock": "<Stock Name>",
                "ticker": "<Ticker>",
                "reason": "<Short explanation based on the sentiment data and context>"
            },
            ...
        ],
        "top_articles": [
            "<Article URL 1>",
            "<Article URL 2>",
            ...
        ]
    }

    Here is an example response in JSON format:

    {
        "best_to_buy": [
            {
                "stock": "Tesla",
                "ticker": "TSLA",
                "reason": "Tesla's strong sales and innovative technology are expected to drive further growth."
            },
            {
                "stock": "Amazon",
                "ticker": "AMZN",
                "reason": "Amazon's stock is part of the 'Magnificent Seven' and continues to show strong performance."
            }
        ],
        "best_to_sell": [
            {
                "stock": "Meta",
                "ticker": "META",
                "reason": "Meta's challenges with content moderation and misinformation concerns make it a risky investment."
            }
        ],
        "neutral_stocks": [
            {
                "stock": "ChargePoint Holdings",
                "ticker": "CHPT",
                "reason": "ChargePoint is expected to take years to turn a profit, leading to neutral sentiment."
            }
        ],
        "top_articles": [
            "https://example.com/article1",
            "https://example.com/article2",
            "https://example.com/article3",
            "https://example.com/article4",
            "https://example.com/article5"
        ]
    }

    For additional clarity, here is the same response represented in a more human-readable format:

    ### Best to Buy
    1. **Tesla (TSLA)**: Tesla's strong sales and innovative technology are expected to drive further growth.
    2. **Amazon (AMZN)**: Amazon's stock is part of the 'Magnificent Seven' and continues to show strong performance.

    ### Best to Sell
    1. **Meta (META)**: Meta's challenges with content moderation and misinformation concerns make it a risky investment.

    ### Neutral Stocks
    1. **ChargePoint Holdings (CHPT)**: ChargePoint is expected to take years to turn a profit, leading to neutral sentiment.

    ### Top Articles
    - [Article 1](https://example.com/article1)
    - [Article 2](https://example.com/article2)
    - [Article 3](https://example.com/article3)
    - [Article 4](https://example.com/article4)
    - [Article 5](https://example.com/article5)

    Provide the response strictly in JSON format.
    """

    # print("-----------------------\n\n")
    # print(top_df)
    # print("\n\n-----------------------")
    # Convert DataFrame to string
    # formatted_string = top_df.to_string(index=False)
    # query = formatted_string
    # print("-----------------------\n\n")
    # print(query)
    # print("\n\n-----------------------")

    # Temporary overwriting query as string because daily limit hit

    query = """
                                                                                                                                                                                                                  title                                                                                                                                                       url  time_published  overall_sentiment_score overall_sentiment_label      ticker ticker_relevance_score ticker_sentiment_score ticker_sentiment_label
                                                                                                                            Musk Fuels Speculation On US Bitcoin Reserve As Crypto Surges - Tesla  ( NASDAQ:TSLA )                               https://www.benzinga.com/markets/cryptocurrency/24/12/42378618/musk-fuels-speculation-on-us-bitcoin-reserve-as-crypto-surges 20241207T194517                 0.318492        Somewhat-Bullish  CRYPTO:BTC               0.967148               0.528882                Bullish
                                                                                                                       Lucid Group Shares Are On The Rise Today: What You Need To Know - Lucid Gr  ( NASDAQ:LCID )                                                     https://www.benzinga.com/24/12/42372227/lucid-group-shares-are-on-the-rise-today-what-you-need-to-know 20241206T195840                 0.119354                 Neutral        LCID               0.864442               0.159067       Somewhat-Bullish
                      PACS COURT NOTICE: PACS Group Investors with Losses are Notified of January 13 Court Deadline in Securities Fraud Class Action - Contact BFA Law  ( NYSE:PACS )  - PACS Group  ( NYSE:PACS )  https://www.benzinga.com/pressreleases/24/12/g42362634/pacs-court-notice-pacs-group-investors-with-losses-are-notified-of-january-13-court-deadline-in-se 20241206T132300                 0.196756        Somewhat-Bullish        PACS                0.82617               0.305751       Somewhat-Bullish
                                      PACS COURT UPDATE: The PACS Group, Inc. Class Action Deadline is January 13 - Investors with Losses are Urged to Contact BFA Law  ( NYSE:PACS )  - PACS Group  ( NYSE:PACS )  https://www.benzinga.com/pressreleases/24/12/g42379675/pacs-court-update-the-pacs-group-inc-class-action-deadline-is-january-13-investors-with-losses-are 20241208T121000                 0.196756        Somewhat-Bullish        PACS                0.82617               0.305751       Somewhat-Bullish
                                                                                                                                                                               Should You Buy Dogecoin Under $0.60?                                                                         https://www.fool.com/investing/2024/12/08/should-you-buy-dogecoin-under-60-cents/ 20241208T113000                 0.282338        Somewhat-Bullish CRYPTO:DOGE               0.818793               0.426363                Bullish
                                                                                                          Google Mafia Dominates Tech's New AI Frontier As Alphabet Alumni Raise $15B - Alphabet  ( NASDAQ:GOOGL )                                                  https://www.benzinga.com/24/12/42364996/the-google-mafia-strikes-again-ex-googlers-rule-the-ai-revolution 20241206T145233                 0.225739        Somewhat-Bullish        GOOG               0.795859               0.237629       Somewhat-Bullish
                   TD COURT NOTICE: TD Bank Investors with Losses are Notified of December 23 Court Deadline in Securities Fraud Class Action - Contact BFA Law  ( NYSE:TD )  - Toronto-Dominion Bank  ( NYSE:TD )  https://www.benzinga.com/pressreleases/24/12/g42362543/td-court-notice-td-bank-investors-with-losses-are-notified-of-december-23-court-deadline-in-securi 20241206T131800                 0.130343                 Neutral          TD                 0.7887               0.105587                Neutral
                                          TD COURT UPDATE: The TD Bank Class Action Deadline is December 23 -Investors with Losses are Urged to Contact BFA Law  ( NYSE:TD )  - Toronto-Dominion Bank  ( NYSE:TD )  https://www.benzinga.com/pressreleases/24/12/g42379679/td-court-update-the-td-bank-class-action-deadline-is-december-23-investors-with-losses-are-urged-t 20241208T121400                 0.130343                 Neutral          TD                 0.7887               0.105587                Neutral
                                          TSLA Stock Rally Since Trump Win Has This Analyst 'Cautious' About EV Giant's Prospects Even As He Maintains 'Very Bullish' Outlook: Here's Why - Tesla  ( NASDAQ:TSLA )  https://www.benzinga.com/24/12/42377001/analyst-says-he-is-very-bullish-but-cautious-about-teslas-stock-rally-notes-eps-revisions-have-not-kept-pace-with 20241207T062518                 0.225452        Somewhat-Bullish        TSLA               0.742397               0.278096       Somewhat-Bullish
                                                                                       More Than Tesla, Rivian Customers Are Most Likely To Return To The Brand, Survey Shows - Rivian Automotive  ( NASDAQ:RIVN )                          https://www.benzinga.com/tech/24/12/42361181/more-than-tesla-rivian-customers-are-most-likely-to-return-to-the-brand-survey-shows 20241206T122537                 0.184445        Somewhat-Bullish        RIVN               0.731269                0.52528                Bullish
                                                                                          Tesla To Rely On Pre-Assembled Superchargers To Keep Up Deployment In Nordic Winters, Says Exec - Tesla  ( NASDAQ:TSLA )                https://www.benzinga.com/tech/24/12/42376450/tesla-to-rely-on-pre-assembled-superchargers-to-keep-up-deployment-in-nordic-winters-says-exec 20241207T021707                -0.055154                 Neutral        TSLA               0.716023              -0.356697                Bearish
                                ASML COURT UPDATE: The ASML Holding N.V. Class Action Deadline is January 13 -Investors with Losses are Urged to Contact BFA Law  ( NASDAQ:ASML )  - ASML Holding  ( NASDAQ:ASML )  https://www.benzinga.com/pressreleases/24/12/g42379658/asml-court-update-the-asml-holding-n-v-class-action-deadline-is-january-13-investors-with-losses-a 20241208T120200                 0.105753                 Neutral        ASML                0.67831               0.193763       Somewhat-Bullish
         ASML COURT NOTICE: ASML Holding N.V. Investors with Losses are Notified of January 13 Court Deadline in Securities Fraud Class Action - Contact BFA Law  ( NASDAQ:ASML )  - ASML Holding  ( NASDAQ:ASML )  https://www.benzinga.com/pressreleases/24/12/g42362218/asml-court-notice-asml-holding-n-v-investors-with-losses-are-notified-of-january-13-court-deadline 20241206T131200                 0.105753                 Neutral        ASML                0.67831               0.193763       Somewhat-Bullish
                    SYM COURT NOTICE: Symbotic Inc. Investors with Losses are Notified of February 3 Court Deadline in Securities Fraud Class Action - Contact BFA Law  ( NASDAQ:SYM )  - Symbotic  ( NASDAQ:SYM )  https://www.benzinga.com/pressreleases/24/12/g42362399/sym-court-notice-symbotic-inc-investors-with-losses-are-notified-of-february-3-court-deadline-in-s 20241206T131600                 0.114554                 Neutral         SYM               0.673107               0.104791                Neutral
                                                                                                                                                                      The Best EV Stock to Invest $500 in Right Now                                                                   https://www.fool.com/investing/2024/12/07/the-best-ev-stock-to-invest-500-in-right-now/ 20241207T090800                 0.135835                 Neutral        RIVN               0.665411               0.216642       Somewhat-Bullish
                                                                                                                                                   MSTR Stock Trade Review  ( Or How to Gain 257.42% in 2 Months )                                                          https://www.zacks.com/commentary/2376302/mstr-stock-trade-review-or-how-to-gain-25742-in-2-months 20241206T143000                 0.227964        Somewhat-Bullish        MSTR               0.658139               0.304139       Somewhat-Bullish
                                                                                                                                                   GM's $5B Q4 China Setback: Is Its Long-Term Growth Story Intact?                                                     https://www.zacks.com/stock/news/2380031/gms-5b-q4-china-setback-is-its-long-term-growth-story-intact 20241206T130800                 0.327891        Somewhat-Bullish          GM               0.654522               0.537093                Bullish
                                                                                             Uber And WeRide Partner For Robotaxi Service In Abu Dhabi - WeRide  ( NASDAQ:WRD ) , Uber Technologies  ( NYSE:UBER )                                              https://www.benzinga.com/24/12/42363171/uber-and-weride-come-together-to-launch-robotaxi-service-in-abu-dhabi 20241206T134614                 0.302842        Somewhat-Bullish        UBER                0.59972               0.286818       Somewhat-Bullish
                                                                    Tesla's Challenges, Rivian's Triumph, And Lucid's Ambitions: This Week In EVs - Lucid Gr  ( NASDAQ:LCID ) , Rivian Automotive  ( NASDAQ:RIVN )                                       https://www.benzinga.com/tech/24/12/42380181/teslas-challenges-rivians-triumph-and-lucids-ambitions-this-week-in-evs 20241208T150020                 0.181036        Somewhat-Bullish        TSLA                0.56217               0.118832                Neutral
                                                                                                                                Tesla Stock vs. Amazon Stock: Billionaires Buy One and Sell the Other Ahead of 2025                                                               https://www.fool.com/investing/2024/12/08/tesla-stock-vs-amazon-stock-billionaire-buy-sell/ 20241208T101200                 0.240511        Somewhat-Bullish        AMZN                0.55533               0.400764                Bullish
                                                                                                                 EVgo Surges With $1 Billion Boost As ChargePoint Stumbles In Tough Market - EVgo  ( NASDAQ:EVGO )             https://www.benzinga.com/analyst-ratings/analyst-color/24/12/42371706/evgo-surges-with-1-billion-boost-as-chargepoint-stumbles-in-tough-market 20241206T191929                 0.424295                 Bullish        EVGO               0.554916               0.694733                Bullish
                                                                                             Uber And WeRide Partner For Robotaxi Service In Abu Dhabi - WeRide  ( NASDAQ:WRD ) , Uber Technologies  ( NYSE:UBER )                                              https://www.benzinga.com/24/12/42363171/uber-and-weride-come-together-to-launch-robotaxi-service-in-abu-dhabi 20241206T134614                 0.302842        Somewhat-Bullish         WRD               0.516656               0.264527       Somewhat-Bullish
                                                                                                                                Tesla Stock vs. Amazon Stock: Billionaires Buy One and Sell the Other Ahead of 2025                                                               https://www.fool.com/investing/2024/12/08/tesla-stock-vs-amazon-stock-billionaire-buy-sell/ 20241208T101200                 0.240511        Somewhat-Bullish        TSLA                0.49637               0.253376       Somewhat-Bullish
             ELAN CLASS ACTION DEADLINE IS TODAY: Elanco Investors are Alerted of December 6 Deadline in Securities Fraud Class Action - Contact BFA Law Now  ( NYSE:ELAN )  - Elanco Animal Health  ( NYSE:ELAN )  https://www.benzinga.com/pressreleases/24/12/g42362365/elan-class-action-deadline-is-today-elanco-investors-are-alerted-of-december-6-deadline-in-securit 20241206T131500                 0.168853        Somewhat-Bullish        ELAN               0.488337               0.226679       Somewhat-Bullish
                                                                                                                                                                             Why AST SpaceMobile Stock Soared Today                                                                         https://www.fool.com/investing/2024/12/06/why-ast-spacemobile-stock-soared-today/ 20241206T233647                 0.377746                 Bullish        ASTS                0.48028               0.358139                Bullish
       EW COURT NOTICE: Edwards Lifesciences Investors with Losses are Notified of December 13 Court Deadline in Securities Fraud Class Action - Contact BFA Law  ( NYSE:EW )  - Edwards Lifesciences  ( NYSE:EW )  https://www.benzinga.com/pressreleases/24/12/g42362610/ew-court-notice-edwards-lifesciences-investors-with-losses-are-notified-of-december-13-court-deadl 20241206T132100                 0.201642        Somewhat-Bullish          EW               0.454945               0.211113       Somewhat-Bullish
                              EW COURT UPDATE: The Edwards Lifesciences Class Action Deadline is December 13 -Investors with Losses are Urged to Contact BFA Law  ( NYSE:EW )  - Edwards Lifesciences  ( NYSE:EW )  https://www.benzinga.com/pressreleases/24/12/g42379668/ew-court-update-the-edwards-lifesciences-class-action-deadline-is-december-13-investors-with-losse 20241208T120700                 0.201642        Somewhat-Bullish          EW               0.454945               0.211113       Somewhat-Bullish
                                                                                                                                                   MSTR Stock Trade Review  ( Or How to Gain 257.42% in 2 Months )                                                          https://www.zacks.com/commentary/2376302/mstr-stock-trade-review-or-how-to-gain-25742-in-2-months 20241206T143000                 0.227964        Somewhat-Bullish  CRYPTO:BTC               0.447528               0.230147       Somewhat-Bullish
                                                                                                                                                 Blink Charging Gets Contract to Supply EV Chargers to Power Design                                               https://www.zacks.com/stock/news/2380251/blink-charging-gets-contract-to-supply-ev-chargers-to-power-design 20241206T144800                 0.216195        Somewhat-Bullish        BLNK                0.43852               0.167731       Somewhat-Bullish
                                                                                       More Than Tesla, Rivian Customers Are Most Likely To Return To The Brand, Survey Shows - Rivian Automotive  ( NASDAQ:RIVN )                          https://www.benzinga.com/tech/24/12/42361181/more-than-tesla-rivian-customers-are-most-likely-to-return-to-the-brand-survey-shows 20241206T122537                 0.184445        Somewhat-Bullish        TSLA               0.419733              -0.161469       Somewhat-Bearish
                         ZETA COURT UPDATE: The Zeta Global Holdings Class Action Deadline is January 21 -Investors with Losses are Urged to Contact BFA Law  ( NYSE:ZETA )  - Zeta Global Holdings  ( NYSE:ZETA )  https://www.benzinga.com/pressreleases/24/12/g42379689/zeta-court-update-the-zeta-global-holdings-class-action-deadline-is-january-21-investors-with-loss 20241208T121500                 0.110728                 Neutral        ZETA               0.419153                0.04919                Neutral
  ZETA COURT NOTICE: Zeta Global Holdings Investors with Losses are Notified of January 21 Court Deadline in Securities Fraud Class Action - Contact BFA Law  ( NYSE:ZETA )  - Zeta Global Holdings  ( NYSE:ZETA )  https://www.benzinga.com/pressreleases/24/12/g42362544/zeta-court-notice-zeta-global-holdings-investors-with-losses-are-notified-of-january-21-court-dead 20241206T131800                 0.110728                 Neutral        ZETA               0.419153                0.04919                Neutral
ACHC COURT NOTICE: Acadia Healthcare Investors with Losses are Notified of December 16 Court Deadline in Securities Fraud Class Action - Contact BFA Law  ( NASDAQ:ACHC )  - Acadia Healthcare Co  ( NASDAQ:ACHC )  https://www.benzinga.com/pressreleases/24/12/g42360868/achc-court-notice-acadia-healthcare-investors-with-losses-are-notified-of-december-16-court-deadli 20241206T120900                 0.121916                 Neutral        ACHC               0.399506               0.041595                Neutral
                      ACHC COURT UPDATE: The Acadia Healthcare Class Action Deadline is December 16 - Investors with Losses are Urged to Contact BFA Law  ( NASDAQ:ACHC )  - Acadia Healthcare Co  ( NASDAQ:ACHC )  https://www.benzinga.com/pressreleases/24/12/g42379841/achc-court-update-the-acadia-healthcare-class-action-deadline-is-december-16-investors-with-losses 20241208T130700                 0.121916                 Neutral        ACHC               0.399506               0.041595                Neutral
                                                                                                                           Worksport  ( $WKSP )  To Showcase Upcoming Innovations Live on FOX & Friends National TV   https://www.globenewswire.com/news-release/2024/12/06/2993234/0/en/Worksport-WKSP-To-Showcase-Upcoming-Innovations-Live-on-FOX-Friends-National-TV.html 20241206T200000                 0.272264        Somewhat-Bullish        WKSP               0.395012               0.501368                Bullish
    """
    llm_response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ],
        response_format={"type": "json_object"}  # Ensures the response is structured as JSON
    )

    response = llm_response.choices[0].message.content
    print("Response: ", response)
    
    return jsonify(response)



if __name__ == '__main__':
    app.run(debug=True)
