import React from 'react';

// Last-resort catch for render/commit crashes anywhere in the app. Without
// this, any uncaught error unmounts the entire React root and leaves a
// blank white page with no way forward but a manual refresh.
//
// The project has no @types/react (React resolves as untyped JS), so the
// inherited class members used here are declared explicitly instead of
// coming from React.Component's (unavailable) typings.
export class ErrorBoundary extends React.Component {
  declare props: { children?: React.ReactNode };
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('Uncaught render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[#F5FAFF] px-6 text-center">
          <p className="text-sm font-bold text-gray-600 max-w-sm">
            Something went wrong displaying this page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-black uppercase tracking-wide text-white bg-[#2E9DF7] border-2 border-black px-5 py-2.5 rounded-full hover:bg-black transition-colors"
          >
            Reload the app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
