'use strict';

// Shared application state — mutated in place by all other modules.
const state = {
  token:          null,
  currentUser:    null,
  offers:         [],
  conversations:  [],
  activeConvId:   null,
  activeConv:     null,
  filters:        {},
  chatPoll:       null,
  selectedPhotos: [],
  purchases:      [],
  complaints:     [],
};
