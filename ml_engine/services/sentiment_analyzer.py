#!/usr/bin/env python3
"""
Sentiment Analysis Service for AIFX_v2 ML Engine

Integrates multiple sentiment sources:
1. News sentiment (NewsAPI)
2. Central bank / government policy sentiment
3. (Future) Social media sentiment

Author: AI-assisted
Created: 2025-11-27
"""

import os
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Optional
import time
import re
from html import unescape
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

# Try to import VADER sentiment analyzer
try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    VADER_AVAILABLE = True
except ImportError:
    VADER_AVAILABLE = False
    logger.warning("VADER sentiment analyzer not available")


class SentimentAnalyzer:
    """
    Multi-source sentiment analysis service
    Combines news, central bank announcements, and policy sentiment
    """

    def __init__(self):
        """Initialize sentiment analyzer with API keys and models"""
        self.news_api_key = os.getenv('NEWS_API_KEY')
        self.newsapi_url = "https://newsapi.org/v2/everything"

        # Cache for API results (to avoid rate limits)
        self.cache = {}
        self.cache_ttl = 3600  # 1 hour cache

        # Sentiment model will be lazy-loaded when first needed
        self.sentiment_model = None
        self._model_loading = False

        # Initialize VADER if available
        self.vader_analyzer = None
        if VADER_AVAILABLE:
            try:
                self.vader_analyzer = SentimentIntensityAnalyzer()
                logger.info("VADER sentiment analyzer initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize VADER: {e}")

        logger.info("SentimentAnalyzer initialized")

    def _load_sentiment_model(self):
        """Lazy load the sentiment analysis model"""
        if self.sentiment_model is not None or self._model_loading:
            return

        try:
            self._model_loading = True
            logger.info("Loading FinBERT sentiment model...")

            from transformers import pipeline

            # Use FinBERT - financial domain specific BERT model
            self.sentiment_model = pipeline(
                "sentiment-analysis",
                model="ProsusAI/finbert",
                truncation=True,
                max_length=512
            )

            logger.info("✅ FinBERT model loaded successfully")

        except ImportError as e:
            logger.warning(f"⚠️ Transformers not installed, using fallback sentiment: {e}")
            self.sentiment_model = None
        except Exception as e:
            logger.error(f"❌ Failed to load sentiment model: {e}")
            self.sentiment_model = None
        finally:
            self._model_loading = False

    def analyze_sentiment(self, pair: str, timeframe: str = "1h") -> Dict:
        """
        Analyze comprehensive sentiment for a currency pair

        Args:
            pair: Currency pair (e.g., "EUR/USD")
            timeframe: Trading timeframe (affects sentiment time window)

        Returns:
            dict: Sentiment analysis result
                {
                    "sentiment_score": 0.0-1.0,  # 0=bearish, 0.5=neutral, 1.0=bullish
                    "confidence": 0.0-1.0,
                    "sources": {
                        "news": 0.65,
                        "central_bank": 0.70
                    },
                    "signal": "bullish" | "bearish" | "neutral",
                    "details": {
                        "news_articles_analyzed": 15,
                        "gov_articles_analyzed": 8
                    },
                    "timestamp": "2025-11-27T10:30:00Z"
                }
        """
        try:
            # Check if NewsAPI is configured
            if not self.news_api_key:
                logger.warning("NEWS_API_KEY not configured, returning neutral sentiment")
                return self._neutral_sentiment("NewsAPI key not configured")

            # Check cache
            cache_key = f"{pair}:{timeframe}"
            if cache_key in self.cache:
                cached_data = self.cache[cache_key]
                if time.time() - cached_data['timestamp'] < self.cache_ttl:
                    logger.info(f"Returning cached sentiment for {pair}")
                    return cached_data['data']

            # Load sentiment model if needed
            self._load_sentiment_model()

            # 1. Analyze news sentiment
            news_sentiment = self._analyze_news_sentiment(pair, timeframe)

            # 2. Analyze central bank / government sentiment
            gov_sentiment = self._analyze_government_sentiment(pair, timeframe)

            # 3. Calculate adaptive weights using hybrid intelligent system (Method E)
            weights = self._calculate_adaptive_weights(
                news_sentiment,
                gov_sentiment,
                timeframe
            )

            # 4. Combine sentiments with adaptive weights
            sentiment_score = (news_sentiment['score'] * weights['news'] +
                              gov_sentiment['score'] * weights['gov'])

            confidence = (news_sentiment['confidence'] * weights['news'] +
                         gov_sentiment['confidence'] * weights['gov'])

            # Determine signal
            if sentiment_score > 0.6:
                signal = "bullish"
            elif sentiment_score < 0.4:
                signal = "bearish"
            else:
                signal = "neutral"

            result = {
                "sentiment_score": round(sentiment_score, 4),
                "confidence": round(confidence, 4),
                "sources": {
                    "news": news_sentiment['score'],
                    "central_bank": gov_sentiment['score']
                },
                "signal": signal,
                "weights": {
                    "news": round(weights['news'], 4),
                    "central_bank": round(weights['gov'], 4),
                    "details": weights.get('details', {})
                },
                "details": {
                    "news_articles_analyzed": news_sentiment.get('count', 0),
                    "gov_articles_analyzed": gov_sentiment.get('count', 0)
                },
                "timestamp": datetime.utcnow().isoformat() + 'Z'
            }

            # Cache result
            self.cache[cache_key] = {
                'data': result,
                'timestamp': time.time()
            }

            logger.info(f"Sentiment for {pair}: {signal} (score: {sentiment_score:.2f}, confidence: {confidence:.2f})")

            return result

        except Exception as e:
            logger.error(f"Sentiment analysis error for {pair}: {e}", exc_info=True)
            return self._neutral_sentiment(f"Error: {str(e)}")

    def _fetch_google_news_rss(self, query: str, max_results: int = 20) -> List[Dict]:
        """
        Fetch news from Google News RSS feed (free, no API key required)

        Args:
            query: Search query
            max_results: Maximum number of results

        Returns:
            List of articles with 'title' and 'description'
        """
        try:
            # Google News RSS URL
            encoded_query = requests.utils.quote(query)
            rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"

            response = requests.get(rss_url, timeout=10)

            if response.status_code != 200:
                logger.warning(f"Google News RSS error: {response.status_code}")
                return []

            # Parse RSS XML
            root = ET.fromstring(response.content)

            articles = []
            for item in root.findall('.//item')[:max_results]:
                title = item.find('title')
                description = item.find('description')

                title_text = title.text if title is not None else ''
                desc_text = description.text if description is not None else ''

                # Clean HTML from description
                desc_text = re.sub(r'<[^>]+>', '', unescape(desc_text))

                if title_text:
                    articles.append({
                        'title': title_text,
                        'description': desc_text[:500]  # Limit description length
                    })

            logger.info(f"Google News RSS: Found {len(articles)} articles for '{query}'")
            return articles

        except Exception as e:
            logger.warning(f"Google News RSS error: {e}")
            return []

    def _analyze_news_sentiment(self, pair: str, timeframe: str) -> Dict:
        """
        Analyze news sentiment for currency pair
        Uses NewsAPI as primary source, Google News RSS as fallback

        Returns:
            {"score": 0.0-1.0, "confidence": 0.0-1.0, "count": int}
        """
        try:
            # Extract currencies (EUR/USD → EUR, USD)
            currencies = pair.replace('/', ' ').split()

            # Determine time window based on timeframe
            hours_map = {
                '15min': 6,
                '1h': 24,
                '4h': 72,
                '1d': 168,  # 1 week
                '1w': 720   # 30 days
            }
            hours = hours_map.get(timeframe, 24)
            from_date = (datetime.now() - timedelta(hours=hours)).isoformat()

            # Multi-tier fallback query strategy
            currency_query = ' '.join(currencies)

            # Tier 1: Strict query (forex-specific)
            queries = [
                f'{currency_query} AND (forex OR "foreign exchange")',
                # Tier 2: Moderate query (financial context)
                f'{currency_query} AND (currency OR "exchange rate" OR FX OR trading)',
                # Tier 3: Loose query (just currencies with financial keywords)
                f'{currency_query} (dollar OR euro OR yen OR pound OR finance)',
                # Tier 4: Very loose (just currency names)
                currency_query
            ]

            articles = []
            query_used = None
            news_source = None

            # Try NewsAPI first (if API key is available)
            if self.news_api_key:
                for i, query in enumerate(queries, 1):
                    logger.debug(f"Trying NewsAPI query tier {i}: {query}")

                    try:
                        response = requests.get(
                            self.newsapi_url,
                            params={
                                'q': query,
                                'from': from_date,
                                'language': 'en',
                                'sortBy': 'relevancy',
                                'pageSize': 20,
                                'apiKey': self.news_api_key
                            },
                            timeout=10
                        )

                        if response.status_code == 429:
                            logger.warning("NewsAPI rate limit hit, falling back to Google News RSS")
                            break
                        elif response.status_code != 200:
                            logger.warning(f"NewsAPI error: {response.status_code}")
                            continue

                        articles = response.json().get('articles', [])

                        if articles:
                            query_used = f"NewsAPI Tier {i}"
                            news_source = "NewsAPI"
                            logger.info(f"Found {len(articles)} articles using NewsAPI tier {i}")
                            break
                    except Exception as e:
                        logger.warning(f"NewsAPI request error: {e}")
                        continue

            # Fallback to Google News RSS if NewsAPI failed or returned no results
            if not articles:
                logger.info("Trying Google News RSS as fallback...")

                # Simpler queries for Google News RSS
                google_queries = [
                    f"{currency_query} forex",
                    f"{currency_query} exchange rate",
                    f"{currency_query} currency"
                ]

                for query in google_queries:
                    articles = self._fetch_google_news_rss(query, max_results=20)
                    if articles:
                        query_used = f"Google RSS: {query}"
                        news_source = "Google News RSS"
                        break

            if not articles:
                logger.info(f"No news articles found for {pair} (tried all sources)")
                return {"score": 0.5, "confidence": 0.0, "count": 0}

            # Analyze sentiment for each article
            sentiments = []

            for article in articles:
                title = article.get('title', '')
                description = article.get('description', '')

                if not title and not description:
                    continue

                text = f"{title} {description}"

                # Analyze with FinBERT if available (best accuracy)
                if self.sentiment_model:
                    try:
                        result = self.sentiment_model(text[:512])[0]

                        # Map FinBERT labels to scores
                        # positive → 0.8 (bullish)
                        # negative → 0.2 (bearish)
                        # neutral → 0.5
                        score_map = {
                            'positive': 0.8,
                            'negative': 0.2,
                            'neutral': 0.5
                        }

                        score = score_map.get(result['label'].lower(), 0.5)
                        confidence = result['score']

                        sentiments.append({
                            'score': score,
                            'confidence': confidence
                        })

                    except Exception as e:
                        logger.debug(f"Error analyzing article: {e}")
                        continue
                # Fallback to VADER if available (good accuracy, fast)
                elif self.vader_analyzer:
                    try:
                        scores = self.vader_analyzer.polarity_scores(text)
                        # VADER compound score is in range [-1, 1]
                        # Map to [0, 1]: compound = -1 → 0 (bearish), compound = 1 → 1 (bullish)
                        compound = scores['compound']
                        score = (compound + 1.0) / 2.0  # Normalize to 0-1

                        # VADER confidence based on absolute compound score
                        # Higher absolute value = higher confidence
                        confidence = min(0.8, abs(compound))

                        sentiments.append({
                            'score': score,
                            'confidence': confidence
                        })

                    except Exception as e:
                        logger.debug(f"VADER analysis error: {e}")
                        # Final fallback: keyword-based
                        sentiment = self._simple_sentiment(text)
                        sentiments.append(sentiment)
                else:
                    # Final fallback: simple keyword-based sentiment
                    sentiment = self._simple_sentiment(text)
                    sentiments.append(sentiment)

            if not sentiments:
                return {"score": 0.5, "confidence": 0.0, "count": 0}

            # Calculate weighted average
            total_weight = sum(s['confidence'] for s in sentiments)
            if total_weight == 0:
                avg_score = sum(s['score'] for s in sentiments) / len(sentiments)
                avg_confidence = 0.3  # Low confidence
            else:
                avg_score = sum(s['score'] * s['confidence'] for s in sentiments) / total_weight
                avg_confidence = sum(s['confidence'] for s in sentiments) / len(sentiments)

            logger.info(f"News sentiment: {len(sentiments)} articles analyzed, score: {avg_score:.2f}")

            return {
                "score": round(avg_score, 4),
                "confidence": round(avg_confidence, 4),
                "count": len(sentiments)
            }

        except Exception as e:
            logger.error(f"News sentiment error: {e}")
            return {"score": 0.5, "confidence": 0.0, "count": 0}

    def _analyze_government_sentiment(self, pair: str, timeframe: str) -> Dict:
        """
        Analyze central bank / government policy sentiment

        Focuses on monetary policy, interest rates, inflation

        Returns:
            {"score": 0.0-1.0, "confidence": 0.0-1.0, "count": int}
        """
        try:
            currencies = pair.replace('/', ' ').split()

            # Map currencies to central banks
            central_banks = {
                'EUR': 'ECB "European Central Bank"',
                'USD': '"Federal Reserve" OR "Fed" OR "FOMC"',
                'JPY': '"Bank of Japan" OR BOJ',
                'GBP': '"Bank of England" OR BoE',
                'CHF': 'SNB "Swiss National Bank"',
                'CAD': '"Bank of Canada"',
                'AUD': 'RBA "Reserve Bank of Australia"',
                'NZD': 'RBNZ "Reserve Bank of New Zealand"'
            }

            # Build query for relevant central banks
            bank_queries = []
            for curr in currencies:
                if curr in central_banks:
                    bank_queries.append(f"({central_banks[curr]})")

            if not bank_queries:
                logger.info(f"No central bank mapping for {pair}")
                return {"score": 0.5, "confidence": 0.0, "count": 0}

            query = ' OR '.join(bank_queries)
            query += ' AND ("interest rate" OR "monetary policy" OR inflation OR "rate decision")'

            # Longer time window for government news (policy changes are slower)
            from_date = (datetime.now() - timedelta(days=14)).isoformat()

            response = requests.get(
                self.newsapi_url,
                params={
                    'q': query,
                    'from': from_date,
                    'language': 'en',
                    'sortBy': 'relevancy',
                    'pageSize': 15,
                    'apiKey': self.news_api_key
                },
                timeout=10
            )

            articles = []
            if response.status_code == 200:
                articles = response.json().get('articles', [])
            else:
                logger.warning(f"NewsAPI error for government: {response.status_code}")

            # Fallback to Google News RSS if NewsAPI failed or returned no results
            if not articles:
                logger.info("Trying Google News RSS for central bank news...")

                # Build Google News queries for central banks
                cb_names = {
                    'EUR': 'ECB European Central Bank',
                    'USD': 'Federal Reserve Fed FOMC',
                    'JPY': 'Bank of Japan BOJ',
                    'GBP': 'Bank of England BoE',
                    'CHF': 'Swiss National Bank SNB',
                    'CAD': 'Bank of Canada',
                    'AUD': 'Reserve Bank Australia RBA',
                    'NZD': 'Reserve Bank New Zealand RBNZ'
                }

                for curr in currencies:
                    if curr in cb_names:
                        # Try different queries
                        google_queries = [
                            f"{cb_names[curr]} interest rate",
                            f"{cb_names[curr]} monetary policy",
                            f"{cb_names[curr]} inflation"
                        ]

                        for gq in google_queries:
                            new_articles = self._fetch_google_news_rss(gq, max_results=10)
                            if new_articles:
                                # Convert to NewsAPI format
                                for a in new_articles:
                                    articles.append({
                                        'title': a.get('title', ''),
                                        'description': a.get('description', '')
                                    })
                                logger.info(f"Google News RSS: Found {len(new_articles)} CB articles for '{gq}'")
                                break

                        if articles:
                            break

            if not articles:
                logger.info(f"No government/CB articles found for {pair}")
                return {"score": 0.5, "confidence": 0.0, "count": 0}

            # Analyze sentiment
            sentiments = []

            for article in articles:
                title = article.get('title', '')
                description = article.get('description', '')
                text = f"{title} {description}"

                if not text.strip():
                    continue

                if self.sentiment_model:
                    try:
                        result = self.sentiment_model(text[:512])[0]

                        # For government/CB news, interpret differently:
                        # positive (hawkish) → 0.6 (slightly bullish for currency)
                        # negative (dovish) → 0.4 (slightly bearish for currency)
                        # neutral → 0.5
                        score_map = {
                            'positive': 0.65,  # Hawkish policy
                            'negative': 0.35,  # Dovish policy
                            'neutral': 0.5
                        }

                        score = score_map.get(result['label'].lower(), 0.5)
                        confidence = result['score']

                        sentiments.append({
                            'score': score,
                            'confidence': confidence
                        })

                    except Exception as e:
                        logger.debug(f"Error analyzing CB article: {e}")
                        continue
                elif self.vader_analyzer:
                    try:
                        scores = self.vader_analyzer.polarity_scores(text)
                        compound = scores['compound']
                        # For CB news, scale differently (more conservative)
                        # Map [-1, 1] to [0.35, 0.65] range
                        score = 0.5 + (compound * 0.15)
                        confidence = min(0.8, abs(compound))

                        sentiments.append({
                            'score': score,
                            'confidence': confidence
                        })

                    except Exception as e:
                        logger.debug(f"VADER analysis error for CB: {e}")
                        sentiment = self._simple_sentiment(text)
                        sentiments.append(sentiment)
                else:
                    sentiment = self._simple_sentiment(text)
                    sentiments.append(sentiment)

            if not sentiments:
                return {"score": 0.5, "confidence": 0.0, "count": 0}

            total_weight = sum(s['confidence'] for s in sentiments)
            if total_weight == 0:
                avg_score = sum(s['score'] for s in sentiments) / len(sentiments)
                avg_confidence = 0.3
            else:
                avg_score = sum(s['score'] * s['confidence'] for s in sentiments) / total_weight
                avg_confidence = sum(s['confidence'] for s in sentiments) / len(sentiments)

            logger.info(f"Government sentiment: {len(sentiments)} articles analyzed, score: {avg_score:.2f}")

            return {
                "score": round(avg_score, 4),
                "confidence": round(avg_confidence, 4),
                "count": len(sentiments)
            }

        except Exception as e:
            logger.error(f"Government sentiment error: {e}")
            return {"score": 0.5, "confidence": 0.0, "count": 0}

    def _simple_sentiment(self, text: str) -> Dict:
        """
        Enhanced weighted keyword-based sentiment analysis
        Used when FinBERT is not available

        Keywords are weighted by intensity:
        - Strong signals (2.0, 0.0): crash, soar, surge, plunge
        - Moderate signals (1.5, 0.3): rally, decline, strengthen, weaken
        - Weak signals (1.2, 0.4): rise, fall, gain, drop
        """
        text_lower = text.lower()

        # Weighted keyword dictionary
        # Format: {'keyword': score} where score is 0.0 (very bearish) to 2.0 (very bullish)
        keyword_weights = {
            # Very strong bullish (1.8-2.0)
            'soar': 2.0, 'surge': 1.9, 'skyrocket': 2.0, 'breakout': 1.8,
            'explosive': 1.9, 'boom': 1.8,

            # Strong bullish (1.5-1.7)
            'rally': 1.6, 'climb': 1.5, 'advance': 1.5, 'outperform': 1.7,
            'strengthen': 1.6, 'uptrend': 1.7, 'bullish': 1.6,

            # Moderate bullish (1.2-1.4)
            'rise': 1.3, 'gain': 1.3, 'increase': 1.2, 'improve': 1.2,
            'grow': 1.3, 'boost': 1.4, 'up': 1.2, 'positive': 1.3,
            'optimistic': 1.4, 'recovery': 1.3, 'rebound': 1.4,

            # Slightly bullish (1.0-1.1)
            'stable': 1.0, 'steady': 1.0, 'hold': 1.0, 'support': 1.1,
            'resilient': 1.1, 'firm': 1.1,

            # Neutral (0.5)
            'unchanged': 0.5, 'flat': 0.5, 'sideways': 0.5, 'mixed': 0.5,

            # Slightly bearish (0.4-0.5)
            'cautious': 0.45, 'uncertain': 0.45, 'resistance': 0.4,
            'pressure': 0.4, 'soft': 0.45,

            # Moderate bearish (0.3-0.4)
            'fall': 0.35, 'drop': 0.35, 'decline': 0.3, 'decrease': 0.35,
            'down': 0.4, 'negative': 0.35, 'weaken': 0.3, 'slip': 0.35,
            'loss': 0.3, 'bearish': 0.3, 'downtrend': 0.25, 'sell': 0.35,

            # Strong bearish (0.1-0.25)
            'plunge': 0.15, 'tumble': 0.2, 'slump': 0.2, 'sink': 0.25,
            'underperform': 0.2, 'breakdown': 0.15, 'retreat': 0.25,

            # Very strong bearish (0.0-0.1)
            'crash': 0.0, 'collapse': 0.05, 'plummet': 0.05, 'dive': 0.1,
            'free-fall': 0.0, 'panic': 0.05, 'crisis': 0.1, 'recession': 0.1,

            # Forex-specific terms
            'hawkish': 1.4, 'dovish': 0.3, 'rate hike': 1.5, 'rate cut': 0.3,
            'tightening': 1.4, 'easing': 0.35, 'tapering': 0.4,
            'stimulus': 0.3, 'intervention': 0.5, 'quantitative easing': 0.25,

            # Technical indicators
            'overbought': 0.3, 'oversold': 1.4, 'golden cross': 1.7,
            'death cross': 0.2, 'bullish divergence': 1.5, 'bearish divergence': 0.3,
        }

        # Calculate weighted sentiment score
        total_weight = 0.0
        weighted_sum = 0.0
        matched_keywords = []

        for keyword, weight in keyword_weights.items():
            if keyword in text_lower:
                # Count occurrences
                count = text_lower.count(keyword)
                total_weight += count
                weighted_sum += (weight * count)
                matched_keywords.append((keyword, weight, count))

        if total_weight == 0:
            # No keywords matched - return neutral with low confidence
            return {"score": 0.5, "confidence": 0.05}

        # Calculate average weighted score (normalize to 0.0-1.0 range)
        # weighted_sum is in range [0, 2.0 * total_weight]
        # Divide by 2.0 to normalize to [0, 1.0]
        avg_score = (weighted_sum / total_weight) / 2.0

        # Confidence based on number of matched keywords
        # More matches = higher confidence (capped at 0.6 for keyword method)
        confidence = min(0.6, total_weight / 15.0)

        logger.debug(f"Keyword analysis: {len(matched_keywords)} keywords, score: {avg_score:.2f}, confidence: {confidence:.2f}")

        return {
            "score": round(avg_score, 4),
            "confidence": round(confidence, 4)
        }

    def _calculate_adaptive_weights(self, news: Dict, gov: Dict, timeframe: str) -> Dict:
        """
        Calculate adaptive weights using hybrid intelligent system (Method E)

        Combines multiple factors:
        1. Base weights according to timeframe (short-term favors news, long-term favors policy)
        2. Data availability adjustment (if one source has no data, use the other)
        3. Confidence adjustment (higher confidence gets higher weight)
        4. Data quantity adjustment (more articles = slightly higher weight)

        Args:
            news: News sentiment result {"score": float, "confidence": float, "count": int}
            gov: Government sentiment result {"score": float, "confidence": float, "count": int}
            timeframe: Trading timeframe (15min, 1h, 4h, 1d, 1w)

        Returns:
            {
                "news": 0.0-1.0,
                "gov": 0.0-1.0,
                "details": {...}
            }
        """

        # 1. Base weights根据时间框架 (短期看新闻, 长期看政策)
        base_weights = {
            '15min': {'news': 0.70, 'gov': 0.30},  # Short-term: news matters more
            '1h':    {'news': 0.60, 'gov': 0.40},
            '4h':    {'news': 0.50, 'gov': 0.50},  # Medium-term: balanced
            '1d':    {'news': 0.40, 'gov': 0.60},
            '1w':    {'news': 0.30, 'gov': 0.70},  # Long-term: policy matters more
        }

        base = base_weights.get(timeframe, {'news': 0.50, 'gov': 0.50})

        # 2. Data availability adjustment (关键！)
        if news['count'] == 0 and gov['count'] == 0:
            # No data at all - return equal weights
            return {
                'news': 0.5,
                'gov': 0.5,
                'details': {
                    'reason': 'no_data',
                    'base': base,
                    'adjustments': {}
                }
            }
        elif news['count'] == 0:
            # Only government data available
            return {
                'news': 0.0,
                'gov': 1.0,
                'details': {
                    'reason': 'no_news_data',
                    'base': base,
                    'adjustments': {'data_availability': -100}
                }
            }
        elif gov['count'] == 0:
            # Only news data available
            return {
                'news': 1.0,
                'gov': 0.0,
                'details': {
                    'reason': 'no_gov_data',
                    'base': base,
                    'adjustments': {'data_availability': +100}
                }
            }

        # 3. Confidence adjustment (置信度越高, 权重越高)
        news_conf = news.get('confidence', 0.0)
        gov_conf = gov.get('confidence', 0.0)
        total_conf = news_conf + gov_conf

        if total_conf > 0:
            conf_ratio = news_conf / total_conf  # 0.0 to 1.0
            # Adjust ±15% based on confidence ratio
            # If news has higher confidence, shift weight toward news
            conf_adjustment = (conf_ratio - 0.5) * 0.30
        else:
            conf_adjustment = 0.0

        # 4. Data quantity adjustment (文章数量影响)
        news_count = news.get('count', 0)
        gov_count = gov.get('count', 0)
        total_count = news_count + gov_count

        if total_count > 0:
            count_ratio = news_count / total_count
            # Slight adjustment ±5% based on article count
            count_adjustment = (count_ratio - 0.5) * 0.10
        else:
            count_adjustment = 0.0

        # 5. Combine all adjustments
        final_news_weight = base['news'] + conf_adjustment + count_adjustment

        # 6. Clamp to valid range [0.1, 0.9] to ensure both sources have some influence
        final_news_weight = max(0.1, min(0.9, final_news_weight))
        final_gov_weight = 1.0 - final_news_weight

        logger.info(
            f"Adaptive weights: news={final_news_weight:.2f}, gov={final_gov_weight:.2f} "
            f"(base: {base['news']:.2f}, conf_adj: {conf_adjustment:+.2f}, "
            f"count_adj: {count_adjustment:+.2f})"
        )

        return {
            'news': final_news_weight,
            'gov': final_gov_weight,
            'details': {
                'base': base,
                'conf_adjustment': round(conf_adjustment, 4),
                'count_adjustment': round(count_adjustment, 4),
                'news_confidence': round(news_conf, 4),
                'gov_confidence': round(gov_conf, 4),
                'news_count': news_count,
                'gov_count': gov_count
            }
        }

    def _neutral_sentiment(self, reason: str = "") -> Dict:
        """Return neutral sentiment as fallback"""
        return {
            "sentiment_score": 0.5,
            "confidence": 0.0,
            "sources": {},
            "signal": "neutral",
            "details": {
                "news_articles_analyzed": 0,
                "gov_articles_analyzed": 0,
                "reason": reason
            },
            "timestamp": datetime.utcnow().isoformat() + 'Z'
        }

    def clear_cache(self):
        """Clear sentiment cache"""
        self.cache = {}
        logger.info("Sentiment cache cleared")


# Test function
def main():
    """Test sentiment analyzer"""
    import sys
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    analyzer = SentimentAnalyzer()

    # Test with EUR/USD
    logger.info("="*80)
    logger.info("Testing Sentiment Analyzer with EUR/USD")
    logger.info("="*80)

    result = analyzer.analyze_sentiment("EUR/USD", "1h")

    import json
    print("\nSentiment Analysis Result:")
    print(json.dumps(result, indent=2))

    logger.info("="*80)
    logger.info("✅ Sentiment Analyzer test completed")
    logger.info("="*80)


if __name__ == '__main__':
    main()
