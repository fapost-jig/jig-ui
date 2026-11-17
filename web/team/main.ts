import { createApp } from 'vue';
import '../lib/theme'; // applies the remembered theme before the first render
import '../style.css';
import TeamApp from './TeamApp.vue';

createApp(TeamApp).mount('#app');
