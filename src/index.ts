import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupyter_autorun extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter_autorun:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyter_autorun is activated!');
  }
};

export default plugin;
