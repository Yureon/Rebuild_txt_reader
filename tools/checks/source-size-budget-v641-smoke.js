const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../..');
const budgets=[
 ['public/styles/app.css',220000],['public/styles/deferred-ui.css',500000],['public/styles/admin-users.css',95000],['public/styles/admin-users-v643.css',20000],['public/styles/admin-users-v649.css',20000],
 ['public/scripts/rebuild/features/reader/virtual-layout.mjs',275000],
 ['server/services/metadata-site-adapters.js',180000]
];
const results=budgets.map(([file,max])=>{const bytes=fs.statSync(path.join(root,file)).size;if(bytes>max)throw new Error(`${file} size ${bytes} exceeds ${max}`);return{file,bytes,max};});
console.log(JSON.stringify({pass:'v641-source-size-budget-pass',results}));
