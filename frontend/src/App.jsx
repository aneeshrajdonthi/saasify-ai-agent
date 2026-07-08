import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_BASE = 'http://localhost:8000/api';

function App() {
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [selectedKbItem, setSelectedKbItem] = useState(null);
  
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'kb'
  const [filterStatus, setFilterStatus] = useState('pending_review'); // 'all' | 'pending_review' | 'replied' | 'ignored'
  
  const [kbForm, setKbForm] = useState({
    id: null,
    category: 'general',
    question: '',
    answer: ''
  });
  
  const [draftReply, setDraftReply] = useState('');
  const [processingEmailId, setProcessingEmailId] = useState(null);
  const [simulatingEmail, setSimulatingEmail] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [geminiActive, setGeminiActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Extension States
  const [toasts, setToasts] = useState([]);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  
  const showToast = (title, body, meta = '') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, body, meta }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Check Backend and API status
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (res.ok) {
        const data = await res.json();
        setApiOnline(true);
        setGeminiActive(data.gemini_active);
        setErrorMsg(null);
      } else {
        setApiOnline(false);
      }
    } catch (e) {
      setApiOnline(false);
    }
  }, []);

  // Fetch Emails
  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/emails`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
        // Sync selected email if it's currently loaded
        if (selectedEmail) {
          const updated = data.find(e => e.id === selectedEmail.id);
          if (updated) {
            setSelectedEmail(updated);
            setDraftReply(updated.ai_draft || '');
          }
        }
      }
    } catch (e) {
      console.error('Error fetching emails:', e);
    }
  }, [selectedEmail]);

  // Fetch Knowledge Base
  const fetchKnowledge = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/knowledge`);
      if (res.ok) {
        const data = await res.json();
        setKnowledgeItems(data);
      }
    } catch (e) {
      console.error('Error fetching knowledge:', e);
    }
  }, []);

  // Initial load and periodic status check
  useEffect(() => {
    checkStatus();
    fetchEmails();
    fetchKnowledge();
    
    const interval = setInterval(() => {
      checkStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Handle email click
  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
    setDraftReply(email.ai_draft || '');
  };

  // Simulate new incoming email
  const handleSimulateEmail = async () => {
    setSimulatingEmail(true);
    try {
      const res = await fetch(`${API_BASE}/emails/simulate`, { method: 'POST' });
      if (res.ok) {
        const newEmail = await res.json();
        await fetchEmails();
        handleSelectEmail(newEmail);
        showToast("Email Simulated 📥", `From: ${newEmail.sender}`, newEmail.subject);
      }
    } catch (e) {
      console.error('Error simulating email:', e);
    } finally {
      setSimulatingEmail(false);
    }
  };

  // Local CSV Exporter
  const handleExportCSV = () => {
    if (emails.length === 0) return;
    const headers = ["ID", "Sender", "Subject", "Status", "Category", "Sentiment", "Confidence", "AI Draft", "Date"];
    const csvRows = [headers.join(",")];
    for (const email of emails) {
      const row = [
        email.id,
        `"${email.sender.replace(/"/g, '""')}"`,
        `"${email.subject.replace(/"/g, '""')}"`,
        email.status,
        email.category,
        email.sentiment,
        email.confidence,
        `"${(email.ai_draft || "").replace(/"/g, '""')}"`,
        email.created_at
      ];
      csvRows.push(row.join(","));
    }
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `saasify_agent_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export Completed 📊", "CSV logs spreadsheet downloaded successfully.");
  };

  // Process email using AI Agent
  const handleProcessEmail = async (emailId) => {
    setProcessingEmailId(emailId);
    try {
      const res = await fetch(`${API_BASE}/emails/${emailId}/process`, { method: 'POST' });
      if (res.ok) {
        const updatedEmail = await res.json();
        await fetchEmails();
        setSelectedEmail(updatedEmail);
        setDraftReply(updatedEmail.ai_draft || '');
      } else {
        setErrorMsg("Failed to process email. Please verify backend logs.");
      }
    } catch (e) {
      console.error('Error processing email:', e);
      setErrorMsg("Network error trying to process email.");
    } finally {
      setProcessingEmailId(null);
    }
  };

  // Send reply
  const handleSendReply = async (emailId) => {
    if (!draftReply.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/emails/${emailId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_body: draftReply })
      });
      if (res.ok) {
        await fetchEmails();
        // Clear selection or move to next one
        setSelectedEmail(null);
      }
    } catch (e) {
      console.error('Error sending reply:', e);
    }
  };

  // Ignore/Archive email
  const handleIgnoreEmail = async (emailId) => {
    try {
      const res = await fetch(`${API_BASE}/emails/${emailId}/ignore`, { method: 'POST' });
      if (res.ok) {
        await fetchEmails();
        setSelectedEmail(null);
      }
    } catch (e) {
      console.error('Error ignoring email:', e);
    }
  };

  // Knowledge Base Actions
  const handleKbSelect = (item) => {
    setSelectedKbItem(item);
    setKbForm({
      id: item.id,
      category: item.category,
      question: item.question,
      answer: item.answer
    });
  };

  const handleKbFormChange = (e) => {
    const { name, value } = e.target;
    setKbForm(prev => ({ ...prev, [name]: value }));
  };

  const handleResetKbForm = () => {
    setSelectedKbItem(null);
    setKbForm({
      id: null,
      category: 'general',
      question: '',
      answer: ''
    });
  };

  const handleSaveKbItem = async (e) => {
    e.preventDefault();
    if (!kbForm.question.trim() || !kbForm.answer.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kbForm)
      });
      if (res.ok) {
        await fetchKnowledge();
        handleResetKbForm();
      }
    } catch (e) {
      console.error('Error saving knowledge:', e);
    }
  };

  const handleDeleteKbItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to delete this context item?")) return;
    try {
      const res = await fetch(`${API_BASE}/knowledge/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchKnowledge();
        handleResetKbForm();
      }
    } catch (e) {
      console.error('Error deleting knowledge:', e);
    }
  };

  // Calculate Metrics
  const totalEmails = emails.length;
  const pendingReview = emails.filter(e => e.status === 'pending_review').length;
  const totalReplied = emails.filter(e => e.status === 'replied').length;
  const positiveSentiment = emails.filter(e => e.sentiment === 'positive').length;

  // Filtered emails
  const filteredEmails = emails.filter(email => {
    if (filterStatus === 'all') return true;
    return email.status === filterStatus;
  });

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">S</div>
          <h1>SaaSify Agentic Automation</h1>
        </div>
        
        <div className="status-panel">
          <nav className="nav-tabs">
            <button 
              className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Email Queue
            </button>
            <button 
              className={`tab-btn ${activeTab === 'kb' ? 'active' : ''}`}
              onClick={() => setActiveTab('kb')}
            >
              Knowledge Base
            </button>
          </nav>

          <div className="api-status">
            <span className={`status-dot ${apiOnline ? 'active' : ''}`}></span>
            Server: {apiOnline ? 'Online' : 'Offline'}
          </div>
          
          <div className="api-status">
            <span className={`status-dot ${geminiActive ? 'active' : apiOnline ? 'warning' : ''}`}></span>
            AI: {geminiActive ? 'Gemini 1.5 Flash' : 'Offline Mock Fallback'}
          </div>
        </div>
      </header>

      {errorMsg && (
        <div className="offline-banner" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', background: 'rgba(239, 68, 68, 0.05)' }}>
          ⚠️ {errorMsg}
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setErrorMsg(null)}>Dismiss</button>
        </div>
      )}

      {/* Connection warning */}
      {!apiOnline && (
        <div className="offline-banner">
          ⚠️ Connection lost. The FastAPI server is not running on <code>http://localhost:8000</code>. Please start the backend script to enable interactive automation.
        </div>
      )}

      {/* Queue View */}
      {activeTab === 'queue' && (
        <>
          {/* Metrics ribbon */}
          <section className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">Total Logs</span>
              <span className="metric-value">{totalEmails}</span>
              <span className="metric-trend">simulated workspace inbox</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Pending Review</span>
              <span className="metric-value">{pendingReview}</span>
              <span className="metric-trend highlight">needs attention</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Auto-Replied</span>
              <span className="metric-value">{totalReplied}</span>
              <span className="metric-trend">successfully resolved</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Positive Sentiment</span>
              <span className="metric-value">{positiveSentiment}</span>
              <span className="metric-trend">happy prospects</span>
            </div>
          </section>

          {/* Main workspace */}
          <div className="workspace">
            {/* Left Column: Email Queue */}
            <div className="panel">
              <div className="panel-header">
                <h2>Email Queue</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportCSV}
                    disabled={emails.length === 0}
                  >
                    Export CSV
                  </button>
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={handleSimulateEmail}
                    disabled={!apiOnline || simulatingEmail}
                  >
                    {simulatingEmail ? <div className="spinner"></div> : '+ Simulate Email'}
                  </button>
                </div>
              </div>
              <div className="panel-body">
                <div className="queue-filters">
                  <button 
                    className={`filter-chip ${filterStatus === 'pending_review' ? 'active' : ''}`}
                    onClick={() => setFilterStatus('pending_review')}
                  >
                    Pending ({pendingReview})
                  </button>
                  <button 
                    className={`filter-chip ${filterStatus === 'replied' ? 'active' : ''}`}
                    onClick={() => setFilterStatus('replied')}
                  >
                    Replied ({totalReplied})
                  </button>
                  <button 
                    className={`filter-chip ${filterStatus === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterStatus('all')}
                  >
                    All ({totalEmails})
                  </button>
                </div>

                <div className="email-list">
                  {filteredEmails.length === 0 ? (
                    <div className="no-data-alert">No emails found in this queue.</div>
                  ) : (
                    filteredEmails.map(email => (
                      <div 
                        key={email.id} 
                        className={`email-item ${selectedEmail?.id === email.id ? 'selected' : ''}`}
                        onClick={() => handleSelectEmail(email)}
                      >
                        <div className="email-item-header">
                          <span className="email-sender">{email.sender}</span>
                          <span className="email-date">
                            {new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="email-subject">{email.subject}</div>
                        <div className="email-tags">
                          <span className={`badge badge-${email.category}`}>{email.category}</span>
                          <span className={`badge badge-${email.status}`}>{email.status.replace('_', ' ')}</span>
                          {email.category !== 'uncategorized' && (
                            <span className={`sentiment-badge sentiment-${email.sentiment}`}>
                              {email.sentiment === 'positive' ? '😊' : email.sentiment === 'negative' ? '😠' : '😐'} {email.sentiment}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Detail & Agent view */}
            <div className="panel">
              <div className="panel-header">
                <h2>Agent Workspace</h2>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                {selectedEmail ? (
                  <div className="detail-view">
                    {/* Header meta */}
                    <div className="detail-header">
                      <div className="detail-meta">
                        <div>
                          <div className="detail-sender">From: {selectedEmail.sender}</div>
                          <h3 className="detail-subject">{selectedEmail.subject}</h3>
                        </div>
                        <div className="email-tags">
                          <span className={`badge badge-${selectedEmail.status}`}>{selectedEmail.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                      
                      <div className="detail-metadata-pills">
                        <span className={`badge badge-${selectedEmail.category}`}>{selectedEmail.category}</span>
                        {selectedEmail.category !== 'uncategorized' && (
                          <>
                            <span className={`sentiment-badge sentiment-${selectedEmail.sentiment}`}>
                              Sentiment: <strong>{selectedEmail.sentiment}</strong>
                            </span>
                            <span className="api-status" style={{ fontSize: '11px', border: 'none' }}>
                              Agent Confidence: <strong>{Math.round(selectedEmail.confidence * 100)}%</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Email body */}
                    <div className="detail-body-container">
                      <div className="detail-body-title">Original Email Body</div>
                      <div className="detail-body">{selectedEmail.body}</div>
                    </div>

                    {/* AI Agent Draft area */}
                    <div className="agent-workspace">
                      {/* Check if processed */}
                      {selectedEmail.category === 'uncategorized' ? (
                        <div className="empty-detail" style={{ flex: 1, padding: '20px 40px' }}>
                          <div className="empty-detail-icon">🤖</div>
                          <h3>Unprocessed Email</h3>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            This email has not been processed by the agent yet. Click below to analyze content, categorize, gauge sentiment, and draft a response.
                          </p>
                          <button 
                            className="btn btn-primary"
                            onClick={() => handleProcessEmail(selectedEmail.id)}
                            disabled={!apiOnline || processingEmailId === selectedEmail.id}
                          >
                            {processingEmailId === selectedEmail.id ? (
                              <><div className="spinner"></div> Running Agentic Reasoning...</>
                            ) : (
                              'Analyze & Draft Response'
                            )}
                          </button>
                        </div>
                      ) : (
                        <>
                          {!geminiActive && (
                            <div className="offline-banner" style={{ margin: 0, padding: '8px 12px', fontSize: '12px' }}>
                              💡 running locally on offline rule-based mock engine.
                            </div>
                          )}
                          
                          <div className="draft-editor-container">
                            <div className="draft-editor-header">
                              <span className="draft-editor-title">AI Drafted Reply</span>
                              {selectedEmail.status === 'pending_review' && (
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleProcessEmail(selectedEmail.id)}
                                  disabled={processingEmailId === selectedEmail.id}
                                >
                                  {processingEmailId === selectedEmail.id ? <div className="spinner"></div> : 'Regenerate Draft'}
                                </button>
                              )}
                            </div>
                            <textarea 
                              className="draft-textarea"
                              value={draftReply}
                              onChange={(e) => setDraftReply(e.target.value)}
                              disabled={selectedEmail.status !== 'pending_review'}
                              placeholder="AI Draft Response will show here..."
                            />
                          </div>

                          {selectedEmail.status === 'pending_review' && (
                            <div className="workspace-actions">
                              <button 
                                className="btn btn-primary" 
                                style={{ flex: 2 }}
                                onClick={() => handleSendReply(selectedEmail.id)}
                              >
                                Approve & Send Reply
                              </button>
                              <button 
                                className="btn btn-danger"
                                style={{ flex: 1 }}
                                onClick={() => handleIgnoreEmail(selectedEmail.id)}
                              >
                                Ignore/Spam
                              </button>
                            </div>
                          )}

                          {/* Prompt logs console */}
                          {selectedEmail.raw_prompt && (
                            <div className="logs-drawer">
                              <div className="logs-drawer-header" onClick={() => setShowLogsDrawer(!showLogsDrawer)}>
                                <div className="logs-drawer-title">
                                  <span>🤖</span> AI Prompt & Response Console
                                </div>
                                <div className="logs-drawer-toggle">
                                  {showLogsDrawer ? 'Hide Logs ▲' : 'Show Logs ▼'}
                                </div>
                              </div>
                              {showLogsDrawer && (
                                <div className="logs-drawer-content">
                                  <div className="log-section">
                                    <h4>Compiled Agent System Prompt Context</h4>
                                    <pre className="raw-log-block">{selectedEmail.raw_prompt}</pre>
                                  </div>
                                  <div className="log-section">
                                    <h4>Raw Gemini JSON Response</h4>
                                    <pre className="raw-log-block">{selectedEmail.raw_response}</pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="empty-detail">
                    <div className="empty-detail-icon">📥</div>
                    <h3>No Email Selected</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Select an incoming email from the queue on the left to start agent operations.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Knowledge Base View */}
      {activeTab === 'kb' && (
        <div className="kb-grid">
          {/* Left panel: List items */}
          <div className="panel">
            <div className="panel-header">
              <h2>KB Articles</h2>
              <button className="btn btn-secondary btn-sm" onClick={handleResetKbForm}>+ New</button>
            </div>
            <div className="panel-body">
              <div className="kb-list">
                {knowledgeItems.length === 0 ? (
                  <div className="no-data-alert">No guidelines set. Add context guidelines for AI drafts.</div>
                ) : (
                  knowledgeItems.map(item => (
                    <div 
                      key={item.id} 
                      className={`kb-item ${selectedKbItem?.id === item.id ? 'selected' : ''}`}
                      onClick={() => handleKbSelect(item)}
                    >
                      <div className="kb-category">{item.category}</div>
                      <div className="kb-title">{item.question}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Editor */}
          <div className="panel">
            <div className="panel-header">
              <h2>{selectedKbItem ? 'Edit Guidelines' : 'New Guidelines'}</h2>
            </div>
            <form onSubmit={handleSaveKbItem} className="kb-editor-form">
              <div className="form-group">
                <label>Category</label>
                <select 
                  className="form-control"
                  name="category"
                  value={kbForm.category}
                  onChange={handleKbFormChange}
                >
                  <option value="general">General Context</option>
                  <option value="pricing">Pricing Details</option>
                  <option value="technical">Technical Support / Integrations</option>
                </select>
              </div>

              <div className="form-group">
                <label>Question / Trigger Keyphrase</label>
                <input 
                  type="text" 
                  className="form-control"
                  name="question"
                  placeholder="e.g. Do you support annual billing discounts?"
                  value={kbForm.question}
                  onChange={handleKbFormChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Resolution Answer (Context Guideline)</label>
                <textarea 
                  className="form-control"
                  name="answer"
                  placeholder="Paste response details, guidelines, or pricing numbers that the AI should cite in its reply..."
                  value={kbForm.answer}
                  onChange={handleKbFormChange}
                  required
                />
              </div>

              <div className="workspace-actions" style={{ marginTop: 'auto' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  Save Context Item
                </button>
                {selectedKbItem && (
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    style={{ flex: 1 }}
                    onClick={() => handleDeleteKbItem(selectedKbItem.id)}
                  >
                    Delete
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={handleResetKbForm}>
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast overlay */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast-card">
            <div className="toast-header">
              <span className="toast-title">{t.title}</span>
              <button className="toast-close" onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}>×</button>
            </div>
            <div className="toast-body">{t.body}</div>
            {t.meta && <div className="toast-meta">{t.meta}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
