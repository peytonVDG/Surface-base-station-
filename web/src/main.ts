import { mount } from 'svelte';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/patrick-hand/400.css';
import './styles.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
