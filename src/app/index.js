// @flow
import React, { memo, useState, useLayoutEffect, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import areEqual from "./areEqual";
import { List, WindowScroller } from "react-virtualized";
import { DragDropContext, Droppable, Draggable } from "../react-beautiful-dnd/src/index";
import "./style.css";
import getInitialData from "./get-initial-data";
import { reorderList } from "./reorder";

const portal = document.createElement('div');
portal.classList.add('my-super-cool-portal');
if (!document.body) throw new Error('body not ready for portal creation!');
document.body.appendChild(portal);

const Delay = memo(function Delay({ delay = 1, children = null }) {
  const [numRenders, setNumRenders] = useState(0);
  useEffect(() => {
    if (numRenders < delay) setNumRenders((n) => ++n);
  });
  return numRenders < delay ? null : children;
})


function getStyle({ draggableStyle, virtualStyle, isDragging }) {
  // If you don't want any spacing between your items
  // then you could just return this.
  // I do a little bit of magic to have some nice visual space
  // between the row items
  const combined = { ...virtualStyle, ...draggableStyle };

  // Being lazy: this is defined in our css file
  const grid = 8;

  // when dragging we want to use the draggable style for placement, otherwise use the virtual style
  const result = {
    ...combined,
    height: isDragging ? combined.height : combined.height - grid,
    left: isDragging ? combined.left : combined.left + grid,
    width: isDragging
      ? draggableStyle.width
      : `calc(${combined.width} - ${grid * 2}px)`,
    marginBottom: grid,
  };

  return result;
}

function Item({ provided, item, style, isDragging, usingPortal = false }) {
  const node = (
    <div
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      ref={provided.innerRef}
      style={getStyle({
        draggableStyle: provided.draggableProps.style,
        virtualStyle: style,
        isDragging,
      })}
      className={`item ${isDragging ? "is-dragging" : ""}`}
    >
      {item.text}
    </div>
  );

  if (usingPortal) return ReactDOM.createPortal(node, portal);
  else return node;
}

function Column({
  provided,
  column,
  index,
  style: virtualStyle,
  isDragging = false,
  isVisible = true,
  usingPortal = false
}) {
  const node = (
    <div
    className="column"
    {...provided.draggableProps}
    ref={provided.innerRef}
    style={getStyle({
      draggableStyle: provided.draggableProps.style,
      virtualStyle,
      isDragging,
    })}
  >
    <h3 className="column-title" {...provided.dragHandleProps}>
      {column.title}
    </h3>
    {isVisible && <ItemList column={column} index={index} />}
  </div>
  );

  if (usingPortal) return ReactDOM.createPortal(node, portal);
  else return node;
}

const makeItemRenderer = (list, isDragging) => ({
  index, // Index of row
  isScrolling, // The List is currently being scrolled
  isVisible, // This row is visible within the List (eg it is not an overscanned row)
  key, // Unique key within array of rendered rows
  parent, // Reference to the parent List (instance)
  style, // Style object to be applied to row (to position it);
  // This must be passed through to the rendered row element.
}) => {
  const item = list[index];


  return <Delay style={style} alt={<Item item={item} style={style} key={key}/>}>
    <ItemDraggable  items={list} index={index} style={style} />
  </Delay>;
};

// Recommended react-window performance optimisation: memoize the row render function
// Things are still pretty fast without this, but I am a sucker for making things faster
const ItemDraggable = memo(function ItemDraggable({ items, index, style }) {
  const item = items[index];

  // We are rendering an extra item for the placeholder
  if (!item) return null;
  return (
    <Draggable draggableId={item.id} index={index} key={item.id}>
      {(provided) => <Item provided={provided} item={item} style={style} />}
    </Draggable>
  );
});

const ColumnDraggable = memo(function ColumnDraggable({
  columns,
  columnOrder,
  isVisible,
  index,
  style,
}) {
  const colIndex = columnOrder[index];
  const column = columns[colIndex];
  // We are rendering an extra item for the placeholder
  if (!column) return null;
  return (
    <Draggable draggableId={column.id} index={index} key={column.id}>
      {(provided, snapshot) => {
        return (
        <Column provided={provided} column={column} index={index} style={style} isVisible={isVisible}/>
      )}}
    </Draggable>
  );
},
areEqual);

const makeColumnRenderer = (columns, columnOrder) => ({
  index, // Index of row
  isScrolling, // The List is currently being scrolled
  isVisible, // This row is visible within the List (eg it is not an overscanned row)
  key, // Unique key within array of rendered rows
  parent, // Reference to the parent List (instance)
  style, // Style object to be applied to row (to position it);
  // This must be passed through to the rendered row element.
}) => {

  return (
    <ColumnDraggable
      key={key}
      columns={columns}
      columnOrder={columnOrder}
      isVisible={isVisible}
      index={index}
      style={style}
    />
  );
};

const ItemList = function ItemList({ column, index }) {
  // There is an issue I have noticed with react-window that when reordered
  // react-window sets the scroll back to 0 but does not update the UI
  // I should raise an issue for this.
  // As a work around I am resetting the scroll to 0
  // on any list that changes it's index
  const listRef = useRef();
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTo(0);
    }
  }, [index]);

  return (
    <Droppable
      type="itemlist"
      droppableId={column.id}
      mode="virtual"
      renderClone={(provided, snapshot, rubric) => (
        <Item
          provided={provided}
          isDragging={snapshot.isDragging}
          item={column.items[rubric.source.index]}
          usingPortal={true}
        />
      )}
    >
      {(provided, snapshot) => {
        // Add an extra item to our list to make space for a dragging item
        // Usually the DroppableProvided.placeholder does this, but that won't
        // work in a virtual list
        const itemCount = snapshot.isUsingPlaceholder
          ? column.items.length + 1
          : column.items.length;

        return (
          <List
            className="task-list"
            height={500}
            width={300}
            rowHeight={80}
            // deferredMeasurementCache={cache.current}
            rowCount={itemCount}
            rowRenderer={makeItemRenderer(column.items, snapshot.isUsingPlaceholder)}
            ref={(ref) => {
              // react-virtualized has no way to get the list's ref that I can so
              // So we use the `ReactDOM.findDOMNode(ref)` escape hatch to get the ref
              if (ref) {
                const VirtualListRef = ReactDOM.findDOMNode(ref);
                if (VirtualListRef instanceof HTMLElement)
                  provided.innerRef(VirtualListRef);
              }
            }}
          />
        );
      }}
    </Droppable>
  );
};

const ColumnList = function ColumnList({ columnOrder, columns }) {
  return (
    <WindowScroller>
      {({ height, isScrolling, registerChild, scrollTop }) => (
        <Droppable
          type="column"
          direction="vertical"
          droppableId="all-droppables"
          mode="virtual"
          renderClone={(provided, snapshot, rubric) => (
            <Column
              provided={provided}
              isDragging={snapshot.isDragging}
              column={columns[columnOrder[rubric.source.index]]}
              index={rubric.source.index}
              usingPortal={true}
            />
          )}
        >
          {(provided, snapshot) => {
            // Add an extra item to our list to make space for a dragging item
            // Usually the DroppableProvided.placeholder does this, but that won't
            // work in a virtual list
            const itemCount = snapshot.isUsingPlaceholder
              ? columnOrder.length + 1
              : columnOrder.length;

            return (
              <List
                autoHeight
                height={height}
                isScrolling={isScrolling}
                scrollTop={scrollTop}
                width={500}
                rowHeight={500}
                // deferredMeasurementCache={cache.current}
                rowCount={itemCount}
                rowRenderer={makeColumnRenderer(columns, columnOrder)}
                ref={(ref) => {
                  // react-virtualized has no way to get the list's ref that I can so
                  // So we use the `ReactDOM.findDOMNode(ref)` escape hatch to get the ref
                  if (ref) {
                    const VirtualListRef = ReactDOM.findDOMNode(ref);
                    if (VirtualListRef instanceof HTMLElement) {
                      provided.innerRef(VirtualListRef);
                      registerChild(VirtualListRef);
                    }
                  }
                }}
              />
            );
          }}
        </Droppable>
      )}
    </WindowScroller>
  );
};

export default function App() {
  const [state, setState] = useState(() => getInitialData());
  function onDragEnd(result) {
    if (!result.destination) return;

    if (result.type === "column") {
      // if the list is scrolled it looks like there is some strangeness going on
      // with react-window. It looks to be scrolling back to scroll: 0
      // I should log an issue with the project
      const columnOrder = reorderList(
        state.columnOrder,
        result.source.index,
        result.destination.index,
      );
      setState({ ...state, columnOrder });
      return;
    }

    // reordering in same list
    if (result.source.droppableId === result.destination.droppableId) {
      const column = state.columns[result.source.droppableId];
      const items = reorderList(
        column.items,
        result.source.index,
        result.destination.index,
      );

      // updating column entry
      const newState = {
        ...state,
        columns: { ...state.columns, [column.id]: { ...column, items } },
      };
      setState(newState);
      return;
    }

    // moving between lists
    const sourceColumn = state.columns[result.source.droppableId];
    const destinationColumn = state.columns[result.destination.droppableId];
    const item = sourceColumn.items[result.source.index];

    // 1. remove item from source column
    const newSourceColumn = { ...sourceColumn, items: [...sourceColumn.items] };
    newSourceColumn.items.splice(result.source.index, 1);

    // 2. insert into destination column
    const newDestinationColumn = {
      ...destinationColumn,
      items: [...destinationColumn.items],
    };
    // in line modification of items
    newDestinationColumn.items.splice(result.destination.index, 0, item);

    const newState = {
      ...state,
      columns: {
        ...state.columns,
        [newSourceColumn.id]: newSourceColumn,
        [newDestinationColumn.id]: newDestinationColumn,
      },
    };

    setState(newState);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="app">
        <ColumnList columnOrder={state.columnOrder} columns={state.columns} />
      </div>
    </DragDropContext>
  );
}

