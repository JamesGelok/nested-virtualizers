let uniqueId = 0;
function getItems(count) {
  return Array.from({ length: count }, (v, k) => {
    const id = uniqueId++;
    return { id: `id:${id}`, text: `item ${id}` };
  });
}

function getOridinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function makeColumnsAndColumnOrder(nColumns, nItemsEach) {
  const columns = {};
  const columnOrder = [];
  for (let i = 0; i < nColumns; i++) {
    const id = `column-${i}`;
    columns[id] = {
      id,
      title: `${getOridinal(i)} column`,
      items: getItems(nItemsEach),
    };
    columnOrder.push(id);
  }
  return { columns, columnOrder };
}

const { columns, columnOrder } = makeColumnsAndColumnOrder(1000, 4);
const initial = { columns, columnOrder };

const getInitialData = () => initial;
export default getInitialData;
