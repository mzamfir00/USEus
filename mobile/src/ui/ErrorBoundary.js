// Catches render errors (and, at the root, uncaught errors from timers or callbacks) and shows
// a monochrome recovery screen instead of a crash or a blank screen.
import React from 'react';
import { View } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import { onUncaughtError } from '../lib/errors';
import { Button, T } from './primitives';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0 };
    this.recover = this.recover.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    if (this.props.global) this.off = onUncaughtError((error) => this.setState({ error }));
  }

  componentWillUnmount() {
    this.off?.();
  }

  componentDidCatch(error, info) {
    console.warn('[app] screen crashed', error, info?.componentStack);
  }

  recover() {
    try {
      this.props.onRecover?.();
    } catch (e) {
      /* recovery is best effort */
    }
    // A new key remounts the children from a clean slate (room state lives above this).
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  }

  render() {
    const { error, attempt } = this.state;
    const { children, title = 'Something went wrong', label = 'Reconnect / Recover round', onLeave } = this.props;
    if (!error) return <React.Fragment key={attempt}>{children}</React.Fragment>;
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }} testID="error-boundary">
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: '#262626', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={24} color="#fff" />
        </View>
        <T size={24} w={700} ls={-0.5} color="#fff" center style={{ marginTop: 20 }}>
          {title}
        </T>
        <T size={14.5} lh={1.4} color="#8a8a8a" center style={{ marginTop: 10, maxWidth: 320 }}>
          USEus hit an unexpected problem. Your account and the room are safe — reconnect to pick up where you left off.
        </T>
        <Button title={label} icon={RotateCcw} onPress={this.recover} bg="#fff" color="#000" style={{ marginTop: 28, alignSelf: 'stretch' }} testID="recover" />
        {onLeave ? <Button variant="ghost" title="Leave the room" color="#8a8a8a" onPress={onLeave} style={{ marginTop: 4, alignSelf: 'stretch' }} /> : null}
      </View>
    );
  }
}
