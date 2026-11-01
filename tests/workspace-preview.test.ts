import test from 'node:test';import assert from 'node:assert/strict';import {workspacePreviewHref} from '../lib/workspace-preview';
test('workspace preview links remain inside the selected administrative route and allow only media sections',()=>{
 assert.equal(workspacePreviewHref('synthetic','/planificador?view=media&section=ooh'),'/consola/espacios/synthetic?view=media&section=ooh');
 assert.equal(workspacePreviewHref('synthetic','/reportes'),'/consola/espacios/synthetic?view=reports');
 assert.equal(workspacePreviewHref('synthetic','https://external.test/purchase'),'/consola/espacios/synthetic');
 assert.equal(workspacePreviewHref('synthetic','/planificador?view=media&section=invalid'),'/consola/espacios/synthetic?view=media&section=tv');
});
