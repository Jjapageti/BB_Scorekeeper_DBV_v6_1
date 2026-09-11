(() => {
  'use strict';

  const firebaseConfig = {
    apiKey: 'AIzaSyB_D95_NLyQGwF6OwwFjxjL91YT1cBsEa0',
    authDomain: 'bb-scorekeeper-web.firebaseapp.com',
    databaseURL: 'https://bb-scorekeeper-web-default-rtdb.firebaseio.com',
    projectId: 'bb-scorekeeper-web',
    storageBucket: 'bb-scorekeeper-web.firebasestorage.app',
    messagingSenderId: '1091864539244',
    appId: '1:1091864539244:web:f186824e28d3d4f4e26849',
    measurementId: 'G-F4L24VR2CP'
  };
  const statePath = 'games/default/state';
  const app = firebase.initializeApp(firebaseConfig);
  const stateRef = app.database().ref(statePath);

  window.BBFirebaseSync = {
    saveState(state) {
      return stateRef.set(state).catch(error => {
        console.error('Firebase state save failed:', error);
      });
    },
    subscribe(onState, onError) {
      const handleValue = snapshot => {
        const remoteState = snapshot.val();
        if (remoteState) onState(remoteState);
      };
      const handleError = error => {
        console.error('Firebase state subscription failed:', error);
        if (onError) onError(error);
      };
      stateRef.on('value', handleValue, handleError);
      return () => stateRef.off('value', handleValue);
    }
  };
})();
