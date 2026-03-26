const { processNewTranslations } = require('./src/services/translatorService');
const mock = [
  { id: '1', name: 'Original Smash', description: 'Chiftea vită, brânză cheddar, castraveți murați, sos SmashMe.' },
  { id: '2', name: 'Cartofi', description: 'Porție simplă de cartofi' },
  { id: '3', name: 'NoDesc', description: '' }
];
processNewTranslations(mock).then(() => console.log('Done test'))
  .catch(console.error);
