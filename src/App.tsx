import Color from 'color'
import html2canvas from 'html2canvas'
import { useEffect, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import GitHubCalendar from 'react-github-contribution-calendar'
import { demoCalendar } from './demoCalendar'
import "./styles/index.css"
import "./styles/main.css"

const REDIRECT_URI = process.env.REACT_APP_NODE_ENV === "prod" ? "https://lukerhoads.github.io/stracal" : "http://localhost:3000/redirect"
const HEX_CHECK = /^#([0-9a-f]{3}){1,2}$/i

type Event = {
  average_heartrate: number,
  distance: number,
  elapsed_time: number,
  elev_high: number,
  elev_low: number, 
  sport_type: string,
  start_date: string,
  average_speed: number,
}

type ConcatEvent = {
  evalMetric: number 
  date: string
}

const genDateString = (date: Date) => {
  return date.toISOString().substring(0, 10)
}

const generateDemoCalendar = () => {
  const events: Record<string, number> = {}
  const today = new Date()
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  while (oneYearAgo < today) {
    const score = Math.floor(Math.random() * 5)
    if (score !== 0) {
      events[genDateString(oneYearAgo)] = score
    }
    oneYearAgo.setDate(oneYearAgo.getDate() + 1)
  }

  return events
}

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [calendarReady, setCalendarReady] = useState(false)
  const [calendarValues, setCalendarValues] = useState({})
  const [mainColor, setMainColor] = useState("#fc4c02")
  const [boxColor, setBoxColor] = useState("#EEEEEE")
  const [colorSet, setColorSet] = useState({})
  const [untilString, setUntilString] = useState('')
  const [mainColorActive, setMainColorActive] = useState(false)
  const [boxColorActive, setBoxColorActive] = useState(false)
  const [userName, setUserName] = useState("")

  const getToken = async (code?: string, refresh?: string) => {
    const baseUrl = `https://www.strava.com/api/v3/oauth/token?client_id=${process.env.REACT_APP_CLIENT_ID}&client_secret=${process.env.REACT_APP_CLIENT_SECRET}`
    const url = baseUrl + (code ? `&code=${code}&grant_type=authorization_code`
      : `&refresh_token=${refresh}&grant_type=refresh_token`)
    return await fetch(url, {
      method: "POST",
    }).then(res => res.json()).then(data => {
      window.location.href = "/"
      localStorage.setItem('strava-access-token', data.access_token)
      localStorage.setItem('strava-refresh-token', data.refresh_token)
      setAuthenticated(true)
    })
  }

  const connectStrava = () => {
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${process.env.REACT_APP_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=read,activity:read_all`
  }

  useEffect(() => {
    if (localStorage.getItem("strava-access-token") !== "undefined" || localStorage.getItem("strava-refresh-token") !== "undefined") {
      setAuthenticated(true)
      return
    }
    
    const splitUrl = window.location.href.split("&")
    if (splitUrl.length === 1) return
    const code = splitUrl[1].slice(5)
    getToken(code)
  }, [])

  useEffect(() => {
    const color = Color("#fc4c02")
    setColorSet({
      box: "#EEEEEE",
      lightest: color.lighten(0.5).hex(),
      lighter: color.lighten(0.25).hex(),
      darker: color.darken(0.25).hex(),
      darkest: color.darken(0.5).hex(),
    })

    const untilDate = new Date(2022, 10, 26)
    setUntilString(genDateString(untilDate))
  }, [])

  useEffect(() => {
    if (!HEX_CHECK.test(mainColor)) return
    const color = Color(mainColor)
    setColorSet({
      box: boxColor,
      lightest: color.lighten(0.5).hex(),
      lighter: color.lighten(0.25).hex(),
      darker: color.darken(0.25).hex(),
      darkest: color.darken(0.5).hex(),
    })
  }, [mainColor, boxColor])

  useEffect(() => {
    if (authenticated) {
      getUserName()
    }
  }, [authenticated])

  const saveCalendar = async () => {
    if (!calendarReady) return 
    const calendarDiv = document.getElementById("export-material")
    if (!calendarDiv) return
    const canvas = await html2canvas(calendarDiv)
    const img = canvas.toDataURL("image/png")
    const res = await fetch(img)
    const blob = await res.blob()
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = img.replace(/^.*[\\\/]/, '');
    a.href = blobUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const getUserName = async () => {
    const res = await fetch(`https://www.strava.com/api/v3/athlete?access_token=${localStorage.getItem('strava-access-token')}`)
    if (!res.ok) return 
    const data = await res.json()
    setUserName(data.username)
  }

  const generateCalendar = async () => {
    if (localStorage.getItem("strava-access-token") === "undefined" || localStorage.getItem("strava-refresh-token") === "undefined") {
      connectStrava()
    }
    
    const scores: Record<string, number> = {}
    let maxMetric = 0;
    let minMetric = Number.MAX_VALUE
    const events: ConcatEvent[] = []
    const today = new Date()
    setUntilString(genDateString(today))
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const oneYearAgoSeconds = Math.floor(oneYearAgo.getTime() / 1000)
    const maxRetries = 2
    let numRetries = 0
    const PAGE_SIZE = 30
    let success = false
    let page = 1
    while (!success && numRetries < maxRetries) {
      const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?access_token=${localStorage.getItem('strava-access-token')}&after=${oneYearAgoSeconds}&page=${page}`)
      if (!res.ok) {
        await getToken(undefined, localStorage.getItem('strava-refresh-token')!)
        numRetries++
        continue
      }

      const data: Event[] = await res.json()
      if (data.length === 0) {
        break 
      } else if (data.length === PAGE_SIZE) {
        page++ 
        continue
      } else if (data.length < PAGE_SIZE) {
        success = true
      }

      data.forEach(event => {
        const startDate = new Date(event.start_date)
        let averageTotalDistance = event.average_speed * event.elapsed_time
        if (event.sport_type.includes("Bike")) {
          averageTotalDistance /= 2
        }
        if (averageTotalDistance > maxMetric) {
          maxMetric = averageTotalDistance
        }
        if (averageTotalDistance < minMetric) {
          minMetric = averageTotalDistance
        }
        events.push({
          evalMetric: averageTotalDistance,
          date: genDateString(startDate)
        })
      })
    }

    const midQuartile = minMetric + (maxMetric - minMetric) / 2
    const upperBottomQuartile = minMetric + (midQuartile - minMetric) / 2 
    const lowerUpperQuartile = maxMetric - (maxMetric - midQuartile) / 2
    events.forEach(event => {
      let accum = 0
      if (scores[event.date]) {
        accum = scores[event.date]
      }
      if (event.evalMetric < upperBottomQuartile) {
        accum += 1
      } else if (event.evalMetric > upperBottomQuartile && event.evalMetric < midQuartile) {
        accum += 2
      } else if (event.evalMetric > midQuartile && event.evalMetric < lowerUpperQuartile) {
        accum += 3
      } else {
        accum += 4
      }
      
      if (accum > 4) {
        accum = 4
      }

      scores[event.date] = accum
    })

    setCalendarValues(scores)
    setCalendarReady(true)
  }

  const toggleMain = () => {
    if (mainColorActive === false) {
      setBoxColorActive(false)
    }
    setMainColorActive(!mainColorActive)
  }

  const toggleBox = () => {
    if (boxColorActive === false) {
      setMainColorActive(false)
    }
    setBoxColorActive(!boxColorActive)
  }

  return (
    <div className="container mx-auto max-w-3xl pt-10 flex flex-col content-between space-y-2">
      <div className='mb-3'>
        <span className="p-1 logo box-decoration-clone bg-gradient-to-r from-orange-500 to-orange-400">
          StraCal
        </span>
      </div>
      
      <div className="flex flex-row gap-5">
        <div>
        <p>Main Color</p>
        <div style={{
          backgroundColor: mainColor,
        }} className={`rounded w-14 h-10`} onClick={() => toggleMain()} />
        </div>

        <div>
        <p>Box Color</p>
        <div style={{
          backgroundColor: boxColor,
        }} className={`rounded w-14 h-10`} onClick={() => toggleBox()} />
        </div>
      </div>

      <div className="">
        { mainColorActive && <HexColorPicker color={mainColor} onChange={(color) => setMainColor(color)} /> }
        { boxColorActive && <HexColorPicker hidden={!boxColorActive} color={boxColor} onChange={(color) => setBoxColor(color)} /> }
      </div>

      { !calendarReady && <p>Demo</p> }
      <div id="export-material" className='border-2 p-3 rounded-lg flex items-left flex-col'>
        <p className='mb-2'>{userName + '\'s Strava Activity'}</p>
        <GitHubCalendar values={calendarReady ? calendarValues : demoCalendar} until={untilString} panelAttributes weekLabelAttributes monthLabelAttributes panelColors={Object.values(colorSet)} />
      </div>

      { calendarReady ? (
        <button className='btn rounded bg-orange-500 text-white py-2 px-3' onClick={() => saveCalendar()}>Save as image</button>
      ) : (
        <>
          { authenticated ? (
            <button className='btn rounded bg-orange-500 text-white py-2 px-3' onClick={() => generateCalendar()}>Generate Calendar</button> 
          ) : (
            <button className='btn rounded bg-orange-500 text-white p-3' onClick={() => connectStrava()}>Connect Strava</button>
          )}
        </>
      )}
    </div>
  );
}

export default App;
