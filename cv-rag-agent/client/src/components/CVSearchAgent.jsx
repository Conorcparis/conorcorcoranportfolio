import React, { useState, useEffect } from 'react';

const CVSearchAgent = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([
    { role: 'agent', content: "Hello! I'm Conor's CV Assistant. How can I help you explore Conor's experience and skills today?" }
  ]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const suggestions = [
    "Tell me about Conor's AI experience",
    "What sales leadership roles has Conor had?",
    "What certifications does Conor have?",
    "Summarize Conor's technical skills",
    "What languages does Conor speak?"
  ];

  // Function to query the CV
  const searchCV = async (searchQuery) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://your-server-url/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });
      
      const data = await response.json();
      
      // Add messages to conversation
      addMessage('user', searchQuery);
      addMessage('agent', data.answer);
    } catch (error) {
      console.error('Error querying CV:', error);
      addMessage('user', searchQuery);
      addMessage('agent', 'Sorry, I encountered an error while processing your request. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add message to conversation
  const addMessage = (role, content) => {
    setConversation(prev => [...prev, { role, content }]);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      searchCV(query);
      setQuery('');
      setShowSuggestions(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    searchCV(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className={`fixed right-0 top-1/4 transition-all duration-300 z-50 ${isExpanded ? 'w-96' : 'w-16'}`}>
      {/* Toggle button */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-0 top-0 transform -translate-x-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-l-lg"
      >
        {isExpanded ? '→' : '←'}
      </button>
      
      {/* Chat interface - only shown when expanded */}
      <div className={`bg-white rounded-l-lg shadow-lg p-4 overflow-hidden ${isExpanded ? 'block' : 'hidden'}`}>
        <div className="mb-4 text-center flex flex-col items-center">
          <div className="w-16 h-16 mb-2">
            <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
              {/* Background with gradient */}
              <rect width="400" height="300" rx="20" fill="url(#backgroundGradient)" />
              
              {/* Brain circuit pattern */}
              <g fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2">
                <path d="M100,100 C120,80 150,90 160,110 C180,140 200,130 220,150 C240,170 270,160 290,180" />
                <path d="M120,200 C140,180 170,190 180,170 C200,140 220,150 240,130 C260,110 280,120 300,100" />
                <circle cx="160" cy="110" r="4" fill="white" stroke="none" />
                <circle cx="220" cy="150" r="4" fill="white" stroke="none" />
                <circle cx="180" cy="170" r="4" fill="white" stroke="none" />
                <circle cx="240" cy="130" r="4" fill="white" stroke="none" />
              </g>
              
              {/* Robot head icon */}
              <g transform="translate(150, 90)">
                <rect x="10" y="10" width="80" height="100" rx="10" fill="#ffffff" />
                <rect x="25" y="30" width="20" height="10" rx="2" fill="#6BA959" />
                <rect x="55" y="30" width="20" height="10" rx="2" fill="#6BA959" />
                <rect x="35" y="70" width="30" height="5" rx="2" fill="#71C9EF" />
                <rect x="25" y="80" width="50" height="5" rx="2" fill="#71C9EF" />
                <circle cx="35" cy="35" r="5" fill="#71C9EF" />
                <circle cx="65" cy="35" r="5" fill="#71C9EF" />
                <path d="M20,0 L80,0 L90,10 L10,10 Z" fill="#ffffff" />
                <rect x="0" y="10" width="10" height="90" fill="#ffffff" />
                <rect x="90" y="10" width="10" height="90" fill="#ffffff" />
                <path d="M10,100 L0,120 L100,120 L90,100 Z" fill="#ffffff" />
              </g>
              
              {/* Definitions for gradients and patterns */}
              <defs>
                <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6BA959" />
                  <stop offset="100%" stopColor="#71C9EF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-1">CV Assistant</h2>
        </div>
        
        {/* Chat history */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3 h-64 overflow-auto">
          {conversation.map((msg, index) => (
            <div key={index} className={`mb-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block rounded-lg p-2 max-w-3/4 ${
                msg.role === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-800'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          )}
        </div>
        
        {/* Suggested queries */}
        {showSuggestions && (
          <div className="mb-3">
            <p className="text-xs text-gray-600 mb-1">Suggested questions:</p>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs py-1 px-2 rounded-full transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Input form */}
        <form onSubmit={handleSubmit} className="flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-grow p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Ask about my experience..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-r-lg transition"
            disabled={isLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default CVSearchAgent;