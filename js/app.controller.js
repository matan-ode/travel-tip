import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

var gUserPos = {}
var gIsClickUserPos = false

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onGetDistanceHtml,
    onCloseDialogModal,
    addLoc,
    updateLoc,
}

function onInit() {
    loadAndRenderLocs()

    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
    // onPanToUserPos()
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()
    // console.log('locs:', locs)
    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                <span class="distance">${onGetDistanceHtml(loc)}</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onGetDistanceHtml(loc) {
    let strHtml = ''
    const locLat = loc.geo.lat
    const locLng = loc.geo.lng
    const latLng1 = { lat: locLat, lng: locLng }

    const latLng2 = gUserPos
    // const latLng2 = utilService.loadFromStorage('userPos') || { lat: gUserPos.lat, lng: gUserPos.lng }
    // console.log(utilService.getDistance(latLng1, latLng2));

    const distance = utilService.getDistance(latLng1, latLng2)

    if (gIsClickUserPos) strHtml = `Distance: ${distance}KM`
    return strHtml
}

function onRemoveLoc(locId) {
    if (confirm('Are you sure you want to delete location?')) {
        locService.remove(locId)
            .then(() => {
                flashMsg('Location removed')
                unDisplayLoc()
                loadAndRenderLocs()
            })
            .catch(err => {
                console.error('OOPs:', err)
                flashMsg('Cannot remove location')
            })
    }
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function onAddLoc(geo) {
    console.log(geo)

    const elModal = document.querySelector('.add-update-modal')
    elModal.showModal()

    const elBtn = document.querySelector('.dialog-btn')
    elBtn.innerText = 'Add'
    elBtn.addEventListener('click', () => addLoc(geo))

    document.querySelector('input.loc-name').value = geo.address || 'Just a place'
}

function loadAndRenderLocs() {
    locService.query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
    console.log('rendering')
}

function onPanToUserPos() {
    gIsClickUserPos = true
    mapService.getUserPosition()
        .then(latLng => {
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)

            gUserPos = { lat: latLng.lat, lng: latLng.lng }
            utilService.saveToStorage('userPos', gUserPos)
            console.log(gUserPos);

        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onUpdateLoc(locId) {
    locService.getById(locId)
        .then(loc => {

            const elModal = document.querySelector('.add-update-modal')
            elModal.showModal()

            const elBtn = document.querySelector('.dialog-btn')
            elBtn.innerText = 'Update'

            document.querySelector('input.loc-name').value = loc.name
            document.querySelector('input.rate').value = loc.rate

            elBtn.addEventListener('click', () => updateLoc(loc))
        })
}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-distance').innerText = `${onGetDistanceHtml(loc)}`
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    // console.log(locId);
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    console.log(sortBy)

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })

    locService.getLocCountByUpdateMap().then(stats => {
        console.log('stats:', stats)
        handleStats(stats, 'loc-stats-update')
    })
}

function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}

function onCloseDialogModal() {
    const elModal = document.querySelector('.add-update-modal')
    elModal.close()
}

function addLoc(geo) {
    console.log('add')

    const elLocName = document.querySelector('input.loc-name').value
    const elRate = document.querySelector('input.rate').value

    if (!elLocName) return

    const loc = {
        name: elLocName,
        rate: elRate,
        geo
    }

    console.log('added loc', loc)

    locService.save(loc)
        .then((savedLoc) => {
            flashMsg(`Added Location (id: ${savedLoc.id})`)
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot add location')
        })
        .finally(onCloseDialogModal())
}

function updateLoc(loc) {
    const elLocName = document.querySelector('input.loc-name').value
    const rate = document.querySelector('input.rate').value

    if (rate !== loc.rate || elLocName !== loc.name) {
        loc.rate = rate
        loc.name = elLocName

        console.log('updated loc', loc)

        locService.save(loc)
            .then(savedLoc => {
                flashMsg(`Rate was set to: ${savedLoc.rate}`)
                loadAndRenderLocs()
            })
            .catch(err => {
                console.error('OOPs:', err)
                flashMsg('Cannot update location')
            })
            .finally(onCloseDialogModal())

    }
}
