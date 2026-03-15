const fs = require('fs');
const path = require('path');

const dict = {
  '├á': 'à', '├í': 'á', '├ó': 'â', '├ú': 'ã', '├º': 'ç', '├®': 'é', '├¬': 'ê', 
  '├¡': 'í', '├│': 'ó', '├┤': 'ô', '├╡': 'õ', '├ö': 'Ó', '├ô': 'Ó', '├║': 'ú', 
  '├ü': 'Á', '├Ç': 'À', '├é': 'Â', '├â': 'Ã', '├è': 'Ê', '├ì': 'Í', '├ç': 'Ç', 
  'ÔÇó': '•', '├Á': 'õ', '├ë': 'É', '├«': 'ê', '├ñ': 'ä', '├¿': 'è', '├»': 'ï', 
  '├╗': 'û', '├╝': 'ü', '├ö': 'Ö', '├Ü': 'Ü', '├æ': 'Ñ', '├ñ': 'ñ'
};

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('c:/Users/paulo/OneDrive/Desktop/master-funnel-mkt_seguro/master-funnel-mkt/src')
  .concat(['c:/Users/paulo/OneDrive/Desktop/master-funnel-mkt_seguro/master-funnel-mkt/server.ts']);

let changed = 0;
files.forEach(p => {
  let c = fs.readFileSync(p, 'utf8');
  const orig = c;
  
  // Custom manual fixes that might have overlapping chars
  c = c.replace(/Hist├│rico/g, 'Histórico')
       .replace(/Estrat├®gia/g, 'Estratégia')
       .replace(/NEG├öCIO/g, 'NEGÓCIO')
       .replace(/neg├│cio/g, 'negócio')
       .replace(/Usu├írio/g, 'Usuário')
       .replace(/usu├írio/g, 'usuário')
       .replace(/├│/g, 'ó'); // fallback

  for (let key in dict) {
    c = c.split(key).join(dict[key]);
  }
  
  if (c !== orig) {
    fs.writeFileSync(p, c, 'utf8');
    changed++;
    console.log(`Fixed ${p}`);
  }
});

console.log('Total fixed ' + changed + ' files.');
