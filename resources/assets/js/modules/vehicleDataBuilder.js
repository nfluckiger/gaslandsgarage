import vehicleData from '../data/vehicles.json'
import sponsorData from '../data/sponsors.json'
import weaponData from '../data/weapons.json'
import upgradeData from '../data/upgrades.json'
import perkData from '../data/perks.json'

const extras = [ 'weapons', 'upgrades', 'perks' ]

const extraData = {
	weapons: weaponData,
	upgrades: upgradeData,
	perks: perkData
}

function getVehicle( slug )
{
	const vehicle = _.find( vehicleData, [ 'slug', slug ] )

	if ( vehicle === undefined )
	{
		throw new Error( `Vehicle ("${ slug }") not recognised` )
	}

	return vehicle
}

function getSponsor( slug )
{
	const sponsor = _.find( sponsorData, [ 'slug', slug ] )

	if ( sponsor === undefined )
	{
		throw new Error( `Sponsor ("${ slug }") not recognised` )
	}

	return sponsor
}

function getExtra( extraType, slug )
{
	const extra = _.find( extraData[ extraType ], [ 'slug', slug ] )

	if ( extra === undefined )
	{
		throw new Error( `Extra ("${ slug }") not recognised for ${ extraType }` )
	}

	return _.cloneDeep( extra )
}

const shortKeys = [
	// shared
	{
		short: 's',
		full: 'slug'
	},
	// team
	{
		short: 'n',
		full: 'name'
	},
	{
		short: 'o',
		full: 'sponsor'
	},
	{
		short: 'a',
		full: 'allowAllPerks'
	},
	{
		short: 'm',
		full: 'maxCost'
	},
	// vehicle
	{
		short: 'l',
		full: 'label'
	},
	{
		short: 'w',
		full: 'weapons',
	},
	{
		short: 'u',
		full: 'upgrades',
	},
	{
		short: 'p',
		full: 'perks'
	},
	{
		short: 'c1',
		full: 'foregroundColour'
	},
	{
		short: 'c2',
		full: 'backgroundColour'
	},
]

const extraShortKeys = _.map( extras, key => _.find( shortKeys, [ 'full', key ] ).short )

function getShortKey( key )
{
	return _.find( shortKeys, [ 'full', key ] ).short
}

function getFullKey( shortKey )
{
	const fullKey = _.find( shortKeys, [ 'short', shortKey ] )

	if ( fullKey === undefined )
	{
		throw new Error( `Short key (${ shortKey }) not recognised` )
	}

	return fullKey.full
}

let descriptionMode = 'short'

const allowedFacings = [ 'front', 'side', 'rear', 'turret' ]

const allowedWarRigLocations = [ 'tractor', 'trailer' ]

export default {

	baseTeamData()
	{
		return {
			id: null,
			name: 'New Team',
			maxCost: 50,
			sponsor: null,
			allowAllPerks: false,
			vehicles: []
		}
	},
	weaponData()
	{
		return weaponData.map( ( weapon ) =>
		{
			// add facing and location properties here so they can be watched in Vehicle.vue
			weapon.facing = 'front'
			weapon.location = null
			return weapon
		} )
	},
	upgradeData()
	{
		return upgradeData
	},
	perkData()
	{
		return perkData
	},
	getUid()
	{
		return Math.random().toString( 36 ).substr( 2, 9 )
	},
	/**
	 * Get vehicle data instance from generic base data
	 *
	 * @param baseVehicleData
	 * @returns {*}
	 */
	vehicleFromBase( baseVehicleData )
	{
		let vehicle = Object.assign(
			{
				uid: this.getUid(),
				label: baseVehicleData.name,
				maxCrew: baseVehicleData.crew * 2,
				weapons: [],
				upgrades: [],
				perks: [],
				colours: {
					foreground: null,
					background: null
				}
			},
			_.cloneDeep( baseVehicleData ) )

		// ensure extras have costs
		for ( const extraType of extras )
		{
			vehicle[ extraType ] = vehicle[ extraType ].map( extra => Object.assign( extra, { cost: 0 } ) )
		}

		return vehicle
	},
	hydrate( dehydratedTeam )
	{
		let hydratedTeam = Object.assign(
			this.baseTeamData(),
			dehydratedTeam )

		hydratedTeam.vehicles = hydratedTeam.vehicles.map( dehydratedVehicle =>
		{
			// rehydrate extras (turn array of slugs into array of data objects)
			for ( const extraType of extras )
			{
				if ( dehydratedVehicle[ extraType ] !== undefined )
				{
					dehydratedVehicle[ extraType ] = dehydratedVehicle[ extraType ].map( slug =>
					{
						let additionalProperties = { removable: true }

						// ! can mean we have a facing or a location... but which is it?
						if ( extraType === 'weapons' && slug.indexOf( '!' ) !== -1 )
						{
							const occurrences = _.countBy( slug )[ '!' ]

							let newSlug, facing, location

							// easy - we have both
							if ( occurrences === 2 )
							{
								[ newSlug, facing, location ] = slug.split( '!' )
							}
							// trickier - we only have one
							else
							{
								let facingOrLocation

								[ newSlug, facingOrLocation ] = slug.split( '!' )

								if ( facingOrLocation === 'trailer' ) // tractor is ignored when dehydrating
								{
									location = facingOrLocation
								}
								else
								{
									facing = facingOrLocation
								}
							}

							slug = newSlug

							if ( facing !== undefined && allowedFacings.indexOf( facing ) !== -1 )
							{
								additionalProperties.facing = facing
							}

							if ( location !== undefined && allowedWarRigLocations.indexOf( location ) !== -1 )
							{
								additionalProperties.location = location
							}
						}

						return Object.assign( getExtra( extraType, slug ),
							additionalProperties )
					} )
				}
			}

			// handle colours
			if ( dehydratedVehicle.foregroundColour && dehydratedVehicle.backgroundColour )
			{
				dehydratedVehicle.colours = {
					foreground: '#' + dehydratedVehicle.foregroundColour,
					background: '#' + dehydratedVehicle.backgroundColour
				}
			}

			// rehydrate rest of vehicle
			let baseVehicleData = getVehicle( dehydratedVehicle.slug ),
			    baseVehicle     = this.vehicleFromBase( baseVehicleData )

			return Object.assign( baseVehicle, dehydratedVehicle )

		} )

		if ( hydratedTeam.sponsor )
		{
			hydratedTeam.sponsor = getSponsor( hydratedTeam.sponsor )
		}

		hydratedTeam.allowAllPerks = hydratedTeam.allowAllPerks !== undefined

		return hydratedTeam
	},
	/**
	 * We only need the slugs for each vehicle and their added extras to reconstitute it
	 *
	 * @param team
	 * @returns {Object}
	 */
	dehydrate( team )
	{
		let dehydratedTeam = {}

		if ( team.name !== 'New Team' )
		{
			dehydratedTeam.name = team.name
		}

		if ( team.sponsor )
		{
			dehydratedTeam.sponsor = team.sponsor.slug
		}

		if ( team.allowAllPerks )
		{
			dehydratedTeam.allowAllPerks = team.allowAllPerks
		}

		if ( team.maxCost !== 50 )
		{
			dehydratedTeam.maxCost = team.maxCost
		}

		let vehicles = []
		for ( const vehicle of team.vehicles )
		{
			let dehydratedVehicle = {}

			dehydratedVehicle.slug = vehicle.slug

			if ( vehicle.label !== vehicle.name )
			{
				dehydratedVehicle.label = vehicle.label
			}

			if ( vehicle.colours.foreground !== null && vehicle.colours.background !== null )
			{
				dehydratedVehicle.foregroundColour = _.trimStart( vehicle.colours.foreground, '#' )
				dehydratedVehicle.backgroundColour = _.trimStart( vehicle.colours.background, '#' )
			}

			for ( const extraType of extras )
			{
				const addedExtras = _.filter( vehicle[ extraType ], extra => extra.cost !== 0 ) // @todo shoddy way of determining built-in upgrades

				if ( addedExtras.length )
				{
					// just an array of slugs
					dehydratedVehicle[ extraType ] = _.map( addedExtras, ( extra ) =>
					{
						let slug = extra.slug

						// weapon facing
						if ( extraType === 'weapons' && extra.facing !== undefined && extra.facing != 'front' )
						{
							slug += '!' + extra.facing
						}

						// war rig location
						if ( extraType === 'weapons' && extra.location !== undefined && extra.location != 'tractor' )
						{
							slug += '!' + extra.location
						}

						return slug
					} )
				}
			}

			vehicles.push( dehydratedVehicle )
		}

		if ( vehicles.length )
		{
			dehydratedTeam.vehicles = vehicles
		}

		return dehydratedTeam
	},
	serialize( team )
	{
		team = this.dehydrate( team )

		let serializedTeam = []

		// team attributes
		_.forIn( team, ( value, key ) =>
		{
			if ( key !== 'vehicles' )
			{
				serializedTeam.push( getShortKey( key ) + '=' + encodeURI( value ) )
			}
		} )

		// vehicles
		if ( team.vehicles !== undefined )
		{
			for ( const vehicle of team.vehicles )
			{
				let serializedVehicle = []

				_.forIn( vehicle, ( value, key ) =>
				{
					if ( !Array.isArray( value ) )
					{
						serializedVehicle.push( getShortKey( key ) + ':' + encodeURI( value ) )
					}
					else
					{
						serializedVehicle.push( getShortKey( key ) + ':' + value.join( '-' ) )
					}
				} )

				serializedTeam.push( 'v=' + serializedVehicle.join( ',' ) )
			}
		}

		return serializedTeam.join( '&' )
	},
	deserialize( uri )
	{
		let deserializedTeam = {}

		const parts = uri.split( '&' )
		for ( const part of parts )
		{
			const [ key, value ] = part.split( '=' )

			// vehicles
			if ( key === 'v' )
			{
				let vehicleParts        = value.split( ',' ),
				    deserializedVehicle = {}

				for ( const vehiclePart of vehicleParts )
				{
					const [ vehicleKey, vehicleValue ] = vehiclePart.split( ':' )

					// extra?
					if ( extraShortKeys.includes( vehicleKey ) )
					{
						deserializedVehicle[ getFullKey( vehicleKey ) ] = vehicleValue.split( '-' )
					}
					else
					{
						deserializedVehicle[ getFullKey( vehicleKey ) ] = decodeURI( vehicleValue )
					}
				}

				if ( deserializedTeam.vehicles === undefined )
				{
					deserializedTeam.vehicles = []
				}

				deserializedTeam.vehicles.push( deserializedVehicle )
			}
			// team attributes
			else
			{
				deserializedTeam[ getFullKey( key ) ] = decodeURI( value )
			}
		}

		try
		{
			return this.hydrate( deserializedTeam )
		}
		catch ( err )
		{
			console.error( err )
			return null
		}
	},
	getVehicleCost( vehicle, sponsorSlug )
	{
		return vehicle.cost +
			_.sumBy( vehicle.weapons, weapon => this.getExtraCost( 'weapons', weapon, sponsorSlug ) ) +
			_.sumBy( vehicle.upgrades, upgrade => this.getExtraCost( 'upgrades', upgrade, sponsorSlug ) ) +
			_.sumBy( vehicle.perks, perk => this.getExtraCost( 'perks', perk, sponsorSlug ) )
	},
	getExtraCost( extraType, extra, sponsorSlug = null )
	{
		if ( extraType === 'weapons' && extra.facing === 'turret' )
		{
			return extra.cost * 3
		}

		if ( sponsorSlug === 'idris' && extraType === 'upgrades' && extra.slug === 'nitro' )
		{
			return Math.ceil( extra.cost / 2 )
		}

		if ( sponsorSlug === 'scarlett' && extraType === 'upgrades' && extra.slug === 'crew' )
		{
			return Math.ceil( extra.cost / 2 )
		}

		return extra.cost
	}
}
