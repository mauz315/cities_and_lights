import Visualizer from './engine/Visualizer.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('app');
    if (container) {
        const visualizer = new Visualizer(container);
        // visualizer.init() is already called in the constructor
        visualizer.loadData();
    } else {
        console.error('The container element with id "app" was not found.');
    }
});