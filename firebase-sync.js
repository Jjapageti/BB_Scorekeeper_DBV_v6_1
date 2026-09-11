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
  const encodeKey = key => key.replace(/[.#$\/\[\]]/g, char => `_fb${char.charCodeAt(0).toString(16)}_`);
  const decodeKey = key => key.replace(/_fb([0-9a-f]+)_/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  const encodeValue = value => {
    if (Array.isArray(value)) return value.map(encodeValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [encodeKey(key), encodeValue(child)]));
  };
  const decodeValue = value => {
    if (Array.isArray(value)) return value.map(decodeValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [decodeKey(key), decodeValue(child)]));
  };

  window.BBFirebaseSync = {
    saveState(state) {
      return stateRef.set(encodeValue(state)).catch(error => {
        console.error('Firebase state save failed:', error);
      });
    },
    subscribe(onState, onError) {
      const handleValue = snapshot => {
        const remoteState = decodeValue(snapshot.val());
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
