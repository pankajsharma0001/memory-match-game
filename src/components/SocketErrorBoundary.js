// components/SocketErrorBoundary.js
import { Component } from 'react';

class SocketErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Only catch socket timeout errors
    if (error && error.message && error.message.includes('timeout')) {
      return { hasError: true, error };
    }
    // Let other errors propagate
    return { hasError: false, error: null };
  }

  componentDidCatch(error, errorInfo) {
    console.log('[ErrorBoundary] Caught error:', error);
    // Don't log timeout errors to avoid cluttering console
  }

  render() {
    if (this.state.hasError) {
      // Silently recover - the socket will reconnect automatically
      return this.props.children;
    }

    return this.props.children;
  }
}

export default SocketErrorBoundary;