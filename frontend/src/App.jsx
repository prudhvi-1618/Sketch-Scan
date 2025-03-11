import { useState, useLayoutEffect, useRef, useEffect } from 'react'
import rough from 'roughjs'
import { getStroke } from 'perfect-freehand'
import { assets } from './assets/assets';

const generator = rough.generator();
const BASE_URL = "https://sketch-scan.vercel.app/";

const createElement = (id, x1, y1, x2, y2, tool) => {
  switch (tool) {
    case "line":
      var roughElement = generator.line(x1, y1, x2, y2);
      return { id, tool, x1, y1, x2, y2, roughElement };
    case "rectangle":
      var roughElement = generator.rectangle(x1, y1, x2 - x1, y2 - y1);
      return { id, tool, x1, y1, x2, y2, roughElement };
    case "circle":
      var roughElement = generator.circle(x1, y1, 2 * (x2 - x1 + y2 - y1));
      return { id, tool, x1, y1, x2, y2, roughElement };
    case "pencil":
      return { id, tool, points: [{ x: x1, y: y1 }] };
  }
}

const average = (a, b) => (a + b) / 2;

function getSvgPathFromStroke(points, closed = true) {
  const len = points.length

  if (len < 4) {
    return ``
  }

  let a = points[0]
  let b = points[1]
  const c = points[2]

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(
    2
  )},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(
    b[1],
    c[1]
  ).toFixed(2)} T`

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i]
    b = points[i + 1]
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(
      2
    )} `
  }

  if (closed) {
    result += 'Z'
  }

  return result
};

const drawElement = (roughCanvas, ctx, element) => {
  switch (element.tool) {
    case "line":
    case "rectangle":
    case "circle":
      roughCanvas.draw(element.roughElement);
      break;
    case "pencil":
      if (element.points && element.points.length > 0) {
        const outlinePoints = getStroke(element.points, {
          size: 8,
          thinning: 0.7,
        });
        const pathData = getSvgPathFromStroke(outlinePoints)
        const myPath = new Path2D(pathData)
        ctx.fill(myPath)
      }

  }
}

function App() {

  const [elements, SetElement] = useState([]);
  const [drawing, SetDrawing] = useState(false);
  const [tool, setTool] = useState("rectangle");
  const [generatedText, SetGeneratedText] = useState([]);

  const canvasRef = useRef(null);

  useLayoutEffect(() => {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext('2d');
    const roughCanvas = rough.canvas(canvas);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    elements.forEach(element => drawElement(roughCanvas, ctx, element));
    ctx.restore();

  }, [elements]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false });
  
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, []);

  const updateElement = (id, x1, y1, x2, y2, type, options) => {
    const elementsCopy = [...elements];
    switch (type) {
      case "line":
      case "rectangle":
      case "circle":
        elementsCopy[id] = createElement(id, x1, y1, x2, y2, tool);
        break;
      case "pencil":
        if (!elementsCopy[id].points) elementsCopy[id].points = [];
        elementsCopy[id].points.push({ x: x2, y: y2 });
        break;
    }

    SetElement(elementsCopy, true);
  };

  const handleMouseDown = (event) => {
    SetDrawing(true);
    const l = 85;
    const { clientX, clientY } = event;
    const id = elements.length;
    const element = createElement(id, clientX, clientY - l, clientX, clientY - l, tool);
    SetElement((prevState) => [...prevState, element]);
  }

  const handleMouseMove = (event) => {

    if (!drawing) return;
    const l = 85;
    const index = elements.length - 1;
    const { x1, y1 } = elements[index];
    const { clientX, clientY } = event;
    updateElement(index, x1, y1, clientX, clientY - l, tool);

  }

  const handleMouseUp = (event) => {
    event.preventDefault();
    SetDrawing(false);
  }

  const handleTouchStart = (event) => {
    event.preventDefault();
    const l = 85;
    SetDrawing(true);
    const { clientX, clientY } = event.touches[0];  // Touch event (first touch point)
    const id = elements.length;
    const element = createElement(id, clientX, clientY - l, clientX, clientY - l, tool);
    SetElement((prevState) => [...prevState, element]);
  };

  const handleTouchMove = (event) => {
    event.preventDefault();
    if (!drawing) return;
    const l = 85;
    const index = elements.length - 1;
    const { x1, y1 } = elements[index];
    const { clientX, clientY } = event.touches[0];  // Touch event
    updateElement(index, x1, y1, clientX, clientY - l, tool);
}  

const handleTouchEnd = (event) => {
  event.preventDefault();
  SetDrawing(false);
}

const handleTouchCancel = (event) => {
  event.preventDefault();  
};


  const handleDownload = () => {
    const canvas = canvasRef.current;

    const imageBase64 = canvas.toDataURL('image/png');


    fetch(BASE_URL + 'calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageBase64,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log(data);

        const k = data.value[0];
        SetGeneratedText([k.expr, k.result]);
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  };

  return (
    <div className='flex flex-col items-center bg-[#ececf4] '>
      <div className=" my-5 py-2 px-5 rounded-xl flex gap-5 bg-[#ffffff]" >
        {["pencil", "rectangle", "line", "circle"].map((element, index) => {
          return (
            <div key={index} className='cursor-pointer '
              onClick={(e) => setTool(element)}
            >
              <img className={`relative group p-2 rounded-lg hover:bg-[#dddde3] ${tool===element?"bg-[#f1f0ff]":null}`}
                src={assets[element]} alt={element} width="40" height="40" />
            </div>
          )
        })}
        <div className=''
          onClick={(e) => handleDownload()}
        >
          <button className="relative group p-2 rounded-lg border-2 cursor-pointer text-[#fff] bg-[#000000] hover:bg-[#fff] hover:text-[#000000]" width="40" height="40" >Generate Text</button>
        </div>
      </div>
      <div className='flex'>
        <canvas
          id="canvas"
          ref={canvasRef}
          width={window.innerWidth}
          height={window.innerHeight - 100}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >

        </canvas>
        {generatedText.length>0?(
          <div className='absolute top-40 right-10 py-7 px-5 rounded-xl bg-[#ffffff] text-zinc-900 text-xl font-medium'>
          <div className='inline-block pr-3' >{generatedText[0]}</div>
          <div className='inline-block pr-3' > = </div>
          <div className='inline-block' >{generatedText[1]}</div>
         </div>
        ):<div></div>}
      </div>
    </div>
  )
}

export default App
