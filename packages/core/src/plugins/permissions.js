// Closed capability catalog for plugins (Fase 2). A plugin manifest may ONLY request
// permissions whose key appears here; anything else fails manifest validation. Each
// entry carries a human label + risk tier used by the install-consent UI ("this plugin
// wants to…"). Keep this list deliberately small and high-level — every new capability
// widens the third-party attack surface and must be reviewed before it's added.

const PERMISSIONS = {
  'config:read':    { label: 'Read your Onyx settings (theme, toggles)', risk: 'low' },
  'notify':         { label: 'Show desktop notifications', risk: 'low' },
  'clipboard:read': { label: 'Read your clipboard history', risk: 'medium' },
  'shell:open':     { label: 'Open links and files in your default apps', risk: 'medium' },
  'net:fetch':      { label: 'Make outbound network requests', risk: 'high' },
  'fs:read':        { label: 'Read files and folders you pick', risk: 'high' },
};

const RISK_ORDER = { low: 0, medium: 1, high: 2 };

function isKnownPermission(key) {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, key);
}

// Highest risk tier among the requested permissions — drives how loud the consent UI is.
function maxRisk(keys) {
  let max = 'low';
  for (const k of keys || []) {
    if (isKnownPermission(k) && RISK_ORDER[PERMISSIONS[k].risk] > RISK_ORDER[max]) max = PERMISSIONS[k].risk;
  }
  return max;
}

// Shape the consent UI renders: [{ key, label, risk }] in the manifest's declared order.
function describePermissions(keys) {
  return (keys || [])
    .filter(isKnownPermission)
    .map((k) => ({ key: k, label: PERMISSIONS[k].label, risk: PERMISSIONS[k].risk }));
}

module.exports = { PERMISSIONS, isKnownPermission, maxRisk, describePermissions };
