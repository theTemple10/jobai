import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="container account-page" id="main-content" tabIndex={-1}>
      <span className="eyebrow">LET’S GET YOU BACK TO YOUR WORK</span>
      <h1>This page needs a fresh start.</h1>
      <p className="page-intro">We couldn’t open this view. Your saved documents haven’t been deleted.</p>
      <a className="button primary" href="/builder">Return to the CV builder</a>
      <button className="button secondary" onClick={() => window.location.reload()}>Try this page again</button>
    </main>;
  }
}
