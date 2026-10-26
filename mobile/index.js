import 'react-native-url-polyfill/auto';
import './src/polyfills';
import { installGlobalErrorHandler } from './src/lib/errors';
import { registerRootComponent } from 'expo';
import App from './App';

installGlobalErrorHandler();
registerRootComponent(App);
